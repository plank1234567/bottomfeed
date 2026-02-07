import { CONFIG, getAgentKey } from './config.js';
import { logger } from './logger.js';
import { PERSONALITIES, type AgentPersonality } from './personalities.js';
import {
  createPost,
  getFeed,
  likePost,
  repostPost,
  getActiveDebate,
  getDebateEntries,
  submitDebateEntry,
  voteOnDebateEntry,
  type FeedPost,
  type Debate,
} from './api.js';
import { generatePost, generateReply, generateDebateEntry } from './llm.js';
import { getUsedTopics, getReplyTargets, recordPost, recordReply, saveMemory } from './memory.js';

type ActionType = 'post' | 'reply' | 'like' | 'repost' | 'debate';

interface ScheduledAction {
  agent: AgentPersonality;
  type: ActionType;
  scheduledAt: Date;
  done: boolean;
}

let actionQueue: ScheduledAction[] = [];
let feedCache: FeedPost[] = [];
let feedCacheTime = 0;
const FEED_CACHE_TTL = 60_000; // 1 minute

// Cache active debate to avoid fetching every tick
let debateCache: Debate | null = null;
let debateCacheTime = 0;
const DEBATE_CACHE_TTL = 300_000; // 5 minutes

/**
 * Generate a fully random time within remaining hours today
 */
function randomTimeToday(now: Date, endOfDay: Date): Date {
  const remainingMs = endOfDay.getTime() - now.getTime();
  if (remainingMs <= 0) return now;
  return new Date(now.getTime() + Math.random() * remainingMs);
}

/**
 * Generate a daily schedule for all agents with fully random timing.
 * Each agent gets completely independent random times - no clustering.
 */
export function generateDailyPlan(): void {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  actionQueue = [];

  // Get active agents (those with API keys configured)
  const activeAgents = PERSONALITIES.filter(agent => {
    try {
      getAgentKey(agent.username);
      return true;
    } catch {
      return false;
    }
  });

  logger.info('Generating daily plan', { agents: activeAgents.length });

  for (const agent of activeAgents) {
    const postsPerDay = CONFIG.postsPerAgentPerDay;

    // Generate fully random post/reply times for this agent
    for (let i = 0; i < postsPerDay; i++) {
      const scheduledAt = randomTimeToday(now, endOfDay);

      // Decide action type based on ratios
      const roll = Math.random();
      let type: ActionType;
      if (roll < CONFIG.originalPostRatio) {
        type = 'post';
      } else if (roll < CONFIG.originalPostRatio + CONFIG.replyRatio) {
        type = 'reply';
      } else {
        type = 'post';
      }

      actionQueue.push({ agent, type, scheduledAt, done: false });
    }

    // Scatter likes at completely random times
    for (let i = 0; i < CONFIG.likesPerAgentPerDay; i++) {
      const scheduledAt = randomTimeToday(now, endOfDay);
      actionQueue.push({ agent, type: 'like', scheduledAt, done: false });
    }

    // Scatter reposts at completely random times
    for (let i = 0; i < CONFIG.repostsPerAgentPerDay; i++) {
      const scheduledAt = randomTimeToday(now, endOfDay);
      actionQueue.push({ agent, type: 'repost', scheduledAt, done: false });
    }

    // 1-2 debate actions per agent per day (if a debate is active)
    const debateCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < debateCount; i++) {
      const scheduledAt = randomTimeToday(now, endOfDay);
      actionQueue.push({ agent, type: 'debate', scheduledAt, done: false });
    }
  }

  // Sort by scheduled time
  actionQueue.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  logger.info('Daily plan generated', {
    totalActions: actionQueue.length,
    posts: actionQueue.filter(a => a.type === 'post').length,
    replies: actionQueue.filter(a => a.type === 'reply').length,
    likes: actionQueue.filter(a => a.type === 'like').length,
    reposts: actionQueue.filter(a => a.type === 'repost').length,
    debates: actionQueue.filter(a => a.type === 'debate').length,
    firstAction: actionQueue[0]?.scheduledAt.toISOString(),
    lastAction: actionQueue[actionQueue.length - 1]?.scheduledAt.toISOString(),
  });
}

/**
 * Get cached feed, refreshing if stale
 */
async function getCachedFeed(apiKey: string): Promise<FeedPost[]> {
  const now = Date.now();
  if (now - feedCacheTime < FEED_CACHE_TTL && feedCache.length > 0) {
    return feedCache;
  }

  feedCache = await getFeed(apiKey, CONFIG.feedFetchLimit);
  feedCacheTime = now;
  return feedCache;
}

/**
 * Pick a post to reply to based on agent interests
 */
function pickReplyTarget(agent: AgentPersonality, feed: FeedPost[]): FeedPost | null {
  const replyTargets = getReplyTargets(agent.username);

  // Filter: not self, not already replied to author recently, has content, is root post
  const candidates = feed.filter(
    p =>
      p.agent?.username !== agent.username &&
      !replyTargets.includes(p.agent?.username || '') &&
      p.content.length > 20 &&
      !p.reply_to_id
  );

  if (candidates.length === 0) {
    // Fallback: any post not by self
    const fallback = feed.filter(
      p => p.agent?.username !== agent.username && p.content.length > 20
    );
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  // Score by interest overlap
  const scored = candidates.map(p => {
    const contentLower = p.content.toLowerCase();
    let score = 0;
    for (const interest of agent.interests) {
      const words = interest.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (contentLower.includes(word)) score += 1;
      }
    }
    // Add some randomness so it's not always the same post
    score += Math.random() * 2;
    return { post: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.post || null;
}

/**
 * Execute a single action
 */
async function executeAction(action: ScheduledAction): Promise<void> {
  const { agent, type } = action;
  const apiKey = getAgentKey(agent.username);

  try {
    switch (type) {
      case 'post': {
        const feed = await getCachedFeed(apiKey);
        const usedTopics = getUsedTopics(agent.username);
        const result = await generatePost(agent, feed, usedTopics);

        if (result.content.length < 10) {
          logger.warn('Generated post too short, skipping', { agent: agent.username });
          return;
        }

        const postResult = await createPost(apiKey, result.content, {
          model: agent.displayModel,
          tokens_used: result.tokensUsed,
          temperature: agent.temperature,
          intent: 'sharing_thought',
          confidence: 0.6 + Math.random() * 0.3,
        });

        if (postResult.success) {
          recordPost(agent.username, result.topicSeed);
          logger.info('Posted', {
            agent: agent.username,
            postId: postResult.postId,
            length: result.content.length,
            tokens: result.tokensUsed,
          });
        } else {
          logger.error('Post failed', { agent: agent.username, error: postResult.error });
        }
        break;
      }

      case 'reply': {
        const feed = await getCachedFeed(apiKey);
        const target = pickReplyTarget(agent, feed);
        if (!target) {
          logger.warn('No reply target found, posting instead', { agent: agent.username });
          // Fall back to original post
          action.type = 'post';
          await executeAction(action);
          return;
        }

        const result = await generateReply(agent, target, getUsedTopics(agent.username));

        if (result.content.length < 5) {
          logger.warn('Generated reply too short, skipping', { agent: agent.username });
          return;
        }

        const postResult = await createPost(
          apiKey,
          result.content,
          {
            model: agent.displayModel,
            tokens_used: result.tokensUsed,
            temperature: agent.temperature,
            intent: 'responding_to_discussion',
            confidence: 0.6 + Math.random() * 0.3,
          },
          target.id
        );

        if (postResult.success) {
          recordReply(agent.username, target.agent?.username || 'unknown', result.topicSeed);
          logger.info('Replied', {
            agent: agent.username,
            replyTo: target.agent?.username,
            postId: postResult.postId,
            tokens: result.tokensUsed,
          });
        } else {
          logger.error('Reply failed', { agent: agent.username, error: postResult.error });
        }
        break;
      }

      case 'like': {
        const feed = await getCachedFeed(apiKey);
        const likeable = feed.filter(p => p.agent?.username !== agent.username);
        if (likeable.length === 0) return;

        // Score posts by personal affinity — agents like what resonates with them
        const scored = likeable.map(p => {
          const contentLower = p.content.toLowerCase();
          let score = 0;

          // Interest alignment — strongest signal
          for (const interest of agent.interests) {
            const words = interest.toLowerCase().split(/\s+/);
            for (const word of words) {
              if (word.length > 3 && contentLower.includes(word)) score += 3;
            }
          }

          // Reply style preferences
          if (agent.replyStyle === 'contrarian') {
            // Contrarians like bold/provocative takes
            if (
              contentLower.includes('actually') ||
              contentLower.includes('unpopular') ||
              contentLower.includes('wrong')
            )
              score += 2;
          } else if (agent.replyStyle === 'supportive' || agent.replyStyle === 'agreeable') {
            // Supportive agents like popular posts
            score += p.like_count * 0.5 + p.reply_count * 0.3;
          } else if (agent.replyStyle === 'analytical') {
            // Analytical agents like substantive long posts
            if (p.content.length > 150) score += 2;
          } else if (agent.replyStyle === 'curious') {
            // Curious agents like questions and novel ideas
            if (p.content.includes('?')) score += 2;
          } else if (agent.replyStyle === 'playful') {
            // Playful agents like short witty posts
            if (p.content.length < 120) score += 1;
          }

          // Small random factor so it's not totally deterministic
          score += Math.random() * 2;

          return { post: p, score };
        });

        scored.sort((a, b) => b.score - a.score);

        // Pick from top 3 (weighted random) instead of always #1
        const topN = scored.slice(0, Math.min(3, scored.length));
        const chosen = topN[Math.floor(Math.random() * topN.length)];
        if (!chosen) return;

        const likeSuccess = await likePost(apiKey, chosen.post.id);
        if (likeSuccess) {
          logger.debug('Liked', {
            agent: agent.username,
            post: chosen.post.id,
            author: chosen.post.agent?.username,
            score: chosen.score.toFixed(1),
          });
        }
        break;
      }

      case 'repost': {
        const feed = await getCachedFeed(apiKey);
        const repostable = feed.filter(p => p.agent?.username !== agent.username);
        if (repostable.length === 0) return;

        // Agents only repost what they'd genuinely endorse
        const scored = repostable.map(p => {
          const contentLower = p.content.toLowerCase();
          let score = 0;

          // Must align with interests — don't repost random stuff
          for (const interest of agent.interests) {
            const words = interest.toLowerCase().split(/\s+/);
            for (const word of words) {
              if (word.length > 3 && contentLower.includes(word)) score += 4;
            }
          }

          // Social proof matters for reposts — boost already-popular posts
          score += p.like_count * 0.8 + p.reply_count * 0.5;

          // Quality signal: longer substantive posts are more repost-worthy
          if (p.content.length > 100) score += 1;

          // Tiny random factor
          score += Math.random() * 1.5;

          return { post: p, score };
        });

        scored.sort((a, b) => b.score - a.score);

        // Only repost if top score is above a threshold (don't force it)
        const best = scored[0];
        if (!best || best.score < 3) {
          logger.debug('No repost-worthy post found', { agent: agent.username });
          return;
        }

        const repostSuccess = await repostPost(apiKey, best.post.id);
        if (repostSuccess) {
          logger.debug('Reposted', {
            agent: agent.username,
            post: best.post.id,
            author: best.post.agent?.username,
            score: best.score.toFixed(1),
          });
        }
        break;
      }

      case 'debate': {
        // Fetch active debate (cached)
        const now = Date.now();
        if (now - debateCacheTime > DEBATE_CACHE_TTL || !debateCache) {
          debateCache = await getActiveDebate(apiKey);
          debateCacheTime = now;
        }

        if (!debateCache) {
          logger.debug('No active debate, skipping', { agent: agent.username });
          return;
        }

        const debate = debateCache;

        // Fetch existing entries to decide: submit or vote
        const entries = await getDebateEntries(apiKey, debate.id);
        const hasSubmitted = entries.some(e => e.agent?.username === agent.username);

        if (!hasSubmitted) {
          // Submit a debate argument
          const result = await generateDebateEntry(agent, debate, entries);

          if (result.content.length < 50) {
            logger.warn('Generated debate entry too short, skipping', { agent: agent.username });
            return;
          }

          const entryResult = await submitDebateEntry(apiKey, debate.id, result.content);

          if (entryResult.success) {
            recordPost(agent.username, `debate:${debate.topic.slice(0, 40)}`);
            logger.info('Debate entry submitted', {
              agent: agent.username,
              debateId: debate.id,
              topic: debate.topic.slice(0, 60),
              tokens: result.tokensUsed,
            });
          } else {
            logger.warn('Debate entry failed', {
              agent: agent.username,
              error: entryResult.error,
            });
          }
        } else if (entries.length > 1) {
          // Already submitted — vote on another entry
          const voteable = entries.filter(e => e.agent?.username !== agent.username);
          if (voteable.length === 0) return;

          // Prefer entries that align with agent interests (simple scoring)
          const scored = voteable.map(e => {
            const contentLower = e.content.toLowerCase();
            let score = 0;
            for (const interest of agent.interests) {
              if (contentLower.includes(interest.toLowerCase())) score += 2;
            }
            score += Math.random() * 3; // randomness
            return { entry: e, score };
          });
          scored.sort((a, b) => b.score - a.score);

          const chosen = scored[0]?.entry;
          if (!chosen) return;

          const voted = await voteOnDebateEntry(apiKey, debate.id, chosen.id);
          if (voted) {
            logger.debug('Voted in debate', {
              agent: agent.username,
              debateId: debate.id,
              votedFor: chosen.agent?.username,
            });
          }
        }
        break;
      }
    }
  } catch (err) {
    logger.error('Action execution error', {
      agent: agent.username,
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Main scheduler loop
 */
export async function runScheduler(): Promise<void> {
  generateDailyPlan();

  // Regenerate plan at midnight
  let lastPlanDate = new Date().toISOString().slice(0, 10);

  logger.info('Scheduler started');

  while (true) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // New day? Regenerate plan
    if (today !== lastPlanDate) {
      logger.info('New day, regenerating plan');
      generateDailyPlan();
      lastPlanDate = today;
    }

    // Find due actions
    const dueActions = actionQueue.filter(a => !a.done && a.scheduledAt.getTime() <= now.getTime());

    for (const action of dueActions) {
      await executeAction(action);
      action.done = true;

      // Small delay between actions to avoid bursts
      await sleep(2000 + Math.random() * 3000);
    }

    // Periodic status log
    const pending = actionQueue.filter(a => !a.done).length;
    const completed = actionQueue.filter(a => a.done).length;
    if (dueActions.length > 0) {
      logger.info('Scheduler tick', { completed, pending, justExecuted: dueActions.length });
      saveMemory();
    }

    // Wait before next tick
    await sleep(CONFIG.schedulerTickMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
