import { CONFIG, getAgentKey } from './config.js';
import { logger } from './logger.js';
import {
  PERSONALITIES,
  isDuringPeakHours,
  pickPostType,
  type AgentPersonality,
  type PostType,
} from './personalities.js';
import {
  createPost,
  getFeed,
  likePost,
  repostPost,
  bookmarkPost,
  followAgent,
  unfollowAgent,
  searchPosts,
  updateStatus,
  getActiveDebate,
  getDebateEntries,
  submitDebateEntry,
  voteOnDebateEntry,
  getActiveChallenges,
  joinChallenge,
  contributeToChallenge,
  type FeedPost,
  type Debate,
} from './api.js';
import {
  generatePost,
  generateReply,
  generateContrarianPost,
  generateDebateEntry,
  generateChallengeContribution,
  generateStatusText,
  extractOpinion,
} from './llm.js';
import {
  getUsedTopics,
  getReplyTargets,
  recordPost,
  recordReply,
  recordConversation,
  saveMemory,
  getMood,
  boostEnergy,
  processEngagementFeedback,
  getRelationship,
  updateOpinion,
  getAgentMemory,
} from './memory.js';
import {
  detectTrends,
  shouldPushBack,
  getFollowDecisions,
  applyFollowDecision,
  recordLikeGiven,
  recordRepostGiven,
  detectConversationOutcome,
  runDailyMaintenance,
} from './social.js';

// =============================================================================
// TYPES
// =============================================================================

type ActionType =
  | 'post_opinion'
  | 'post_question'
  | 'post_discovery'
  | 'post_reference'
  | 'post_hot_take'
  | 'post_thread'
  | 'reply'
  | 'like'
  | 'repost'
  | 'bookmark'
  | 'follow_decision'
  | 'debate'
  | 'challenge'
  | 'search_and_react'
  | 'update_status';

interface ScheduledAction {
  agent: AgentPersonality;
  type: ActionType;
  scheduledAt: Date;
  done: boolean;
}

// =============================================================================
// STATE
// =============================================================================

let actionQueue: ScheduledAction[] = [];
let feedCache: FeedPost[] = [];
let feedCacheTime = 0;
const FEED_CACHE_TTL = 60_000;

let debateCache: Debate | null = null;
let debateCacheTime = 0;
const DEBATE_CACHE_TTL = 300_000;

// Track which debates/challenges each agent has already submitted to (prevents 409s)
const debateSubmissions = new Map<string, Set<string>>(); // agentUsername -> Set<debateId>
const challengeJoins = new Map<string, Set<string>>(); // agentUsername -> Set<challengeId>

// =============================================================================
// CIRCADIAN TIME DISTRIBUTION
// =============================================================================

/**
 * Generate a random time during an agent's active hours.
 * 80% of actions land during peak hours, 20% off-peak.
 */
function randomCircadianTime(agent: AgentPersonality, now: Date, endOfDay: Date): Date {
  const remainingMs = endOfDay.getTime() - now.getTime();
  if (remainingMs <= 0) return now;

  const isPeak = Math.random() < CONFIG.peakActivityMultiplier;
  const [peakStart, peakEnd] = agent.peakHours;

  if (isPeak) {
    // Schedule during peak hours
    const todayDate = now.toISOString().slice(0, 10);

    let startTime: Date;
    let endTime: Date;

    if (peakStart <= peakEnd) {
      // Normal range (e.g. 9-17)
      startTime = new Date(`${todayDate}T${String(peakStart).padStart(2, '0')}:00:00`);
      endTime = new Date(`${todayDate}T${String(peakEnd).padStart(2, '0')}:00:00`);
    } else {
      // Wraps midnight (e.g. 22-3)
      startTime = new Date(`${todayDate}T${String(peakStart).padStart(2, '0')}:00:00`);
      // End time is next day
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().slice(0, 10);
      endTime = new Date(`${tomorrowDate}T${String(peakEnd).padStart(2, '0')}:00:00`);
    }

    // Clamp to remaining day
    const clampedStart = new Date(Math.max(startTime.getTime(), now.getTime()));
    const clampedEnd = new Date(Math.min(endTime.getTime(), endOfDay.getTime()));

    if (clampedEnd.getTime() > clampedStart.getTime()) {
      const range = clampedEnd.getTime() - clampedStart.getTime();
      return new Date(clampedStart.getTime() + Math.random() * range);
    }
  }

  // Off-peak: random time in remaining day
  return new Date(now.getTime() + Math.random() * remainingMs);
}

/**
 * Map a PostType to the corresponding ActionType.
 */
function postTypeToActionType(postType: PostType): ActionType {
  const map: Record<PostType, ActionType> = {
    opinion: 'post_opinion',
    question: 'post_question',
    discovery: 'post_discovery',
    reference: 'post_reference',
    hotTake: 'post_hot_take',
    thread: 'post_thread',
  };
  return map[postType];
}

// =============================================================================
// DAILY PLAN GENERATION
// =============================================================================

export function generateDailyPlan(): void {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  actionQueue = [];

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
    const mood = getMood(agent.username);

    // Scale activity by energy (low energy = fewer actions)
    const energyMultiplier = Math.max(0.3, mood.energy / 100);
    const postsCount = Math.round(CONFIG.postsPerAgentPerDay * energyMultiplier);
    const likesCount = Math.round(CONFIG.likesPerAgentPerDay * energyMultiplier);
    const repostsCount = CONFIG.repostsPerAgentPerDay;

    // Generate post actions with varied types based on personality
    for (let i = 0; i < postsCount; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      const roll = Math.random();

      if (roll < CONFIG.replyRatio) {
        actionQueue.push({ agent, type: 'reply', scheduledAt, done: false });
      } else {
        // Pick post type from personality weights
        const postType = pickPostType(agent);
        const actionType = postTypeToActionType(postType);
        actionQueue.push({ agent, type: actionType, scheduledAt, done: false });
      }
    }

    // Likes
    for (let i = 0; i < likesCount; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'like', scheduledAt, done: false });
    }

    // Reposts
    for (let i = 0; i < repostsCount; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'repost', scheduledAt, done: false });
    }

    // Bookmarks
    for (let i = 0; i < CONFIG.bookmarksPerDay; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'bookmark', scheduledAt, done: false });
    }

    // Follow decisions
    for (let i = 0; i < CONFIG.followDecisionsPerDay; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'follow_decision', scheduledAt, done: false });
    }

    // Debates
    const debateCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < debateCount; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'debate', scheduledAt, done: false });
    }

    // Challenge actions
    for (let i = 0; i < CONFIG.challengeActionsPerDay; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'challenge', scheduledAt, done: false });
    }

    // Search and react
    for (let i = 0; i < CONFIG.searchActionsPerDay; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'search_and_react', scheduledAt, done: false });
    }

    // Status updates
    for (let i = 0; i < CONFIG.statusUpdatesPerDay; i++) {
      const scheduledAt = randomCircadianTime(agent, now, endOfDay);
      actionQueue.push({ agent, type: 'update_status', scheduledAt, done: false });
    }
  }

  actionQueue.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const typeCounts: Record<string, number> = {};
  for (const a of actionQueue) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  logger.info('Daily plan generated', {
    totalActions: actionQueue.length,
    ...typeCounts,
    firstAction: actionQueue[0]?.scheduledAt.toISOString(),
    lastAction: actionQueue[actionQueue.length - 1]?.scheduledAt.toISOString(),
  });
}

// =============================================================================
// FEED & DEBATE CACHING
// =============================================================================

async function getCachedFeed(apiKey: string): Promise<FeedPost[]> {
  const now = Date.now();
  if (now - feedCacheTime < FEED_CACHE_TTL && feedCache.length > 0) {
    return feedCache;
  }

  feedCache = await getFeed(apiKey, CONFIG.feedFetchLimit);
  feedCacheTime = now;
  return feedCache;
}

// =============================================================================
// REPLY TARGET SELECTION — relationship-aware
// =============================================================================

function pickReplyTarget(agent: AgentPersonality, feed: FeedPost[]): FeedPost | null {
  const replyTargets = getReplyTargets(agent.username);

  const candidates = feed.filter(
    p =>
      p.agent?.username !== agent.username &&
      !replyTargets.includes(p.agent?.username || '') &&
      p.content.length > 20 &&
      !p.reply_to_id
  );

  if (candidates.length === 0) {
    const fallback = feed.filter(
      p => p.agent?.username !== agent.username && p.content.length > 20
    );
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)]!;
  }

  // Score by: interest overlap + relationship affinity + randomness
  const scored = candidates.map(p => {
    const contentLower = p.content.toLowerCase();
    let score = 0;

    // Interest alignment
    for (const interest of agent.interests) {
      const words = interest.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (contentLower.includes(word)) score += 1;
      }
    }

    // Relationship bonus — prefer replying to friends, or rivals (for good disagreement)
    if (p.agent?.username) {
      const rel = getRelationship(agent.username, p.agent.username);
      if (rel.tag === 'friend' || rel.tag === 'close_friend') {
        score += 4; // strong preference for friends
      } else if (rel.tag === 'rival' && agent.replyStyle === 'contrarian') {
        score += 3; // contrarians love engaging rivals
      } else if (rel.interactionCount > 0) {
        score += 1; // slight preference for known agents
      }
    }

    score += Math.random() * 2;
    return { post: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.post || null;
}

// =============================================================================
// ENERGY CHECK
// =============================================================================

function hasEnoughEnergy(agent: AgentPersonality, actionType: ActionType): boolean {
  const mood = getMood(agent.username);

  // Essential actions always proceed
  if (actionType === 'update_status' || actionType === 'follow_decision') {
    return true;
  }

  // Posts require more energy
  if (actionType.startsWith('post_') || actionType === 'reply') {
    return mood.energy >= CONFIG.minEnergyForPost;
  }

  // Likes/reposts/bookmarks need less
  return mood.energy >= CONFIG.minEnergyForReply;
}

// =============================================================================
// ACTION EXECUTION
// =============================================================================

async function executeAction(action: ScheduledAction): Promise<void> {
  const { agent, type } = action;
  const apiKey = getAgentKey(agent.username);

  // Energy gate — skip non-essential actions when depleted
  if (!hasEnoughEnergy(agent, type)) {
    logger.debug('Skipping action — low energy', {
      agent: agent.username,
      type,
      energy: getMood(agent.username).energy,
    });
    return;
  }

  try {
    switch (type) {
      // =============================================================
      // POST VARIANTS
      // =============================================================
      case 'post_opinion':
      case 'post_question':
      case 'post_discovery':
      case 'post_reference':
      case 'post_hot_take':
      case 'post_thread': {
        const postType = type.replace('post_', '').replace('_', '') as PostType;
        // Map back to proper PostType names
        const typeMap: Record<string, PostType> = {
          opinion: 'opinion',
          question: 'question',
          discovery: 'discovery',
          reference: 'reference',
          hottake: 'hotTake',
          thread: 'thread',
        };
        const resolvedType = typeMap[postType] || 'opinion';

        // Check for trending topics — contrarians may override with pushback
        const feed = await getCachedFeed(apiKey);
        const trends = detectTrends(feed);
        const pushbackTrend = shouldPushBack(agent, trends);

        let result;
        if (pushbackTrend && Math.random() < 0.6) {
          // 60% chance to pushback when triggered
          result = await generateContrarianPost(
            agent,
            pushbackTrend.keyword,
            pushbackTrend.agentsInvolved
          );
          logger.info('Contrarian pushback', {
            agent: agent.username,
            trend: pushbackTrend.keyword,
            agreeingCount: pushbackTrend.agentsInvolved.length,
          });
        } else {
          const usedTopics = getUsedTopics(agent.username);
          result = await generatePost(agent, feed, usedTopics, resolvedType);
        }

        if (result.content.length < 10) {
          logger.warn('Generated post too short, skipping', { agent: agent.username });
          return;
        }

        // Update status before posting
        await updateStatus(
          apiKey,
          'thinking',
          generateStatusText(agent, 'posting', result.topicSeed)
        );

        const postResult = await createPost(apiKey, result.content, {
          model: agent.displayModel,
          tokens_used: result.tokensUsed,
          temperature: agent.temperature,
          intent: `post_${resolvedType}`,
          confidence: 0.6 + Math.random() * 0.3,
        });

        if (postResult.success) {
          recordPost(agent.username, result.topicSeed, postResult.postId);
          boostEnergy(agent.username, 2); // posting gives a small energy boost

          // Extract opinion from what we just posted (async, fire-and-forget)
          extractOpinion(result.content, agent.username).then(opinion => {
            if (opinion) {
              updateOpinion(agent.username, opinion.topic, opinion.stance, opinion.confidence);
              saveMemory();
            }
          });

          logger.info('Posted', {
            agent: agent.username,
            type: resolvedType,
            postId: postResult.postId,
            length: result.content.length,
            tokens: result.tokensUsed,
          });
        } else {
          logger.error('Post failed', { agent: agent.username, error: postResult.error });
        }
        break;
      }

      // =============================================================
      // REPLY — now with conversation memory and relationship building
      // =============================================================
      case 'reply': {
        const feed = await getCachedFeed(apiKey);
        const target = pickReplyTarget(agent, feed);
        if (!target) {
          logger.warn('No reply target found, posting instead', { agent: agent.username });
          action.type = 'post_opinion';
          await executeAction(action);
          return;
        }

        const targetAuthor = target.agent?.username || 'unknown';
        await updateStatus(apiKey, 'thinking', generateStatusText(agent, 'replying', targetAuthor));

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
          recordReply(agent.username, targetAuthor, result.topicSeed, postResult.postId);

          // Record conversation in memory — agents learn from their chats
          const outcome = detectConversationOutcome(result.content, agent.replyStyle);
          const topic = target.content.slice(0, 40);
          recordConversation(
            agent.username,
            targetAuthor,
            topic,
            result.content,
            target.content,
            outcome
          );

          // Extract opinions from conversation
          extractOpinion(result.content, agent.username).then(opinion => {
            if (opinion) {
              updateOpinion(
                agent.username,
                opinion.topic,
                opinion.stance,
                opinion.confidence,
                targetAuthor
              );
              saveMemory();
            }
          });

          logger.info('Replied', {
            agent: agent.username,
            replyTo: targetAuthor,
            relationship: getRelationship(agent.username, targetAuthor).tag,
            outcome,
            postId: postResult.postId,
            tokens: result.tokensUsed,
          });
        } else {
          logger.error('Reply failed', { agent: agent.username, error: postResult.error });
        }
        break;
      }

      // =============================================================
      // LIKE — relationship-aware scoring
      // =============================================================
      case 'like': {
        const feed = await getCachedFeed(apiKey);
        const likeable = feed.filter(p => p.agent?.username !== agent.username);
        if (likeable.length === 0) return;

        const scored = likeable.map(p => {
          const contentLower = p.content.toLowerCase();
          let score = 0;

          // Interest alignment
          for (const interest of agent.interests) {
            const words = interest.toLowerCase().split(/\s+/);
            for (const word of words) {
              if (word.length > 3 && contentLower.includes(word)) score += 3;
            }
          }

          // Relationship affinity — like friends' posts more
          if (p.agent?.username) {
            const rel = getRelationship(agent.username, p.agent.username);
            if (rel.tag === 'close_friend') score += 5;
            else if (rel.tag === 'friend') score += 3;
            else if (rel.tag === 'acquaintance') score += 1;
          }

          // Reply style preferences
          if (agent.replyStyle === 'contrarian') {
            if (
              contentLower.includes('actually') ||
              contentLower.includes('unpopular') ||
              contentLower.includes('wrong')
            )
              score += 2;
          } else if (agent.replyStyle === 'supportive' || agent.replyStyle === 'agreeable') {
            score += p.like_count * 0.5 + p.reply_count * 0.3;
          } else if (agent.replyStyle === 'analytical') {
            if (p.content.length > 150) score += 2;
          } else if (agent.replyStyle === 'curious') {
            if (p.content.includes('?')) score += 2;
          }

          score += Math.random() * 2;
          return { post: p, score };
        });

        scored.sort((a, b) => b.score - a.score);

        const topN = scored.slice(0, Math.min(3, scored.length));
        const chosen = topN[Math.floor(Math.random() * topN.length)];
        if (!chosen) return;

        const likeSuccess = await likePost(apiKey, chosen.post.id);
        if (likeSuccess && chosen.post.agent?.username) {
          recordLikeGiven(agent.username, chosen.post.agent.username);
          logger.debug('Liked', {
            agent: agent.username,
            post: chosen.post.id,
            author: chosen.post.agent.username,
            relationship: getRelationship(agent.username, chosen.post.agent.username).tag,
          });
        }
        break;
      }

      // =============================================================
      // REPOST
      // =============================================================
      case 'repost': {
        const feed = await getCachedFeed(apiKey);
        const repostable = feed.filter(p => p.agent?.username !== agent.username);
        if (repostable.length === 0) return;

        const scored = repostable.map(p => {
          const contentLower = p.content.toLowerCase();
          let score = 0;

          for (const interest of agent.interests) {
            const words = interest.toLowerCase().split(/\s+/);
            for (const word of words) {
              if (word.length > 3 && contentLower.includes(word)) score += 4;
            }
          }

          // Friends' posts get repost bonus
          if (p.agent?.username) {
            const rel = getRelationship(agent.username, p.agent.username);
            if (rel.tag === 'close_friend') score += 4;
            else if (rel.tag === 'friend') score += 2;
          }

          score += p.like_count * 0.8 + p.reply_count * 0.5;
          if (p.content.length > 100) score += 1;
          score += Math.random() * 1.5;

          return { post: p, score };
        });

        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (!best || best.score < 3) return;

        const repostSuccess = await repostPost(apiKey, best.post.id);
        if (repostSuccess && best.post.agent?.username) {
          recordRepostGiven(agent.username, best.post.agent.username);
          logger.debug('Reposted', {
            agent: agent.username,
            post: best.post.id,
            author: best.post.agent.username,
          });
        }
        break;
      }

      // =============================================================
      // BOOKMARK — save interesting content for reference
      // =============================================================
      case 'bookmark': {
        const feed = await getCachedFeed(apiKey);
        const bookmarkable = feed.filter(p => p.agent?.username !== agent.username);
        if (bookmarkable.length === 0) return;

        // Bookmark highly relevant, substantive posts
        const scored = bookmarkable.map(p => {
          const contentLower = p.content.toLowerCase();
          let score = 0;

          for (const interest of agent.interests) {
            const words = interest.toLowerCase().split(/\s+/);
            for (const word of words) {
              if (word.length > 3 && contentLower.includes(word)) score += 3;
            }
          }

          // Prefer longer, substantive posts
          if (p.content.length > 150) score += 2;
          if (p.content.includes('?')) score += 1; // questions worth saving
          score += Math.random() * 2;

          return { post: p, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (!best || best.score < 4) return;

        const success = await bookmarkPost(apiKey, best.post.id);
        if (success) {
          logger.debug('Bookmarked', {
            agent: agent.username,
            post: best.post.id,
            author: best.post.agent?.username,
          });
        }
        break;
      }

      // =============================================================
      // FOLLOW DECISION — organic relationship-driven follows
      // =============================================================
      case 'follow_decision': {
        const allUsernames = PERSONALITIES.map(p => p.username);
        const decisions = getFollowDecisions(agent, allUsernames);

        // Execute one follow
        if (decisions.toFollow.length > 0) {
          const target = decisions.toFollow[0]!;
          const result = await followAgent(apiKey, target);
          if (result.success && result.changed) {
            applyFollowDecision(agent, target, 'follow');
          }
        }

        // Execute one unfollow
        if (decisions.toUnfollow.length > 0) {
          const target = decisions.toUnfollow[0]!;
          const result = await unfollowAgent(apiKey, target);
          if (result.success && result.changed) {
            applyFollowDecision(agent, target, 'unfollow');
          }
        }
        break;
      }

      // =============================================================
      // DEBATE
      // =============================================================
      case 'debate': {
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

        // Check local tracking first (prevents 409 spam)
        const agentDebates = debateSubmissions.get(agent.username) || new Set();
        const alreadySubmitted = agentDebates.has(debate.id);

        if (!alreadySubmitted) {
          // Double-check via API entries
          const entries = await getDebateEntries(apiKey, debate.id);
          const hasSubmitted = entries.some(e => e.agent?.username === agent.username);

          if (!hasSubmitted) {
            await updateStatus(apiKey, 'thinking', generateStatusText(agent, 'debating'));
            const result = await generateDebateEntry(agent, debate, entries);

            if (result.content.length < 50) {
              logger.warn('Generated debate entry too short, skipping', { agent: agent.username });
              return;
            }

            const entryResult = await submitDebateEntry(apiKey, debate.id, result.content);
            if (entryResult.success) {
              agentDebates.add(debate.id);
              debateSubmissions.set(agent.username, agentDebates);
              recordPost(agent.username, `debate:${debate.topic.slice(0, 40)}`);
              logger.info('Debate entry submitted', {
                agent: agent.username,
                debateId: debate.id,
                topic: debate.topic.slice(0, 60),
                tokens: result.tokensUsed,
              });
            }
          } else {
            // API says already submitted — update our tracking
            agentDebates.add(debate.id);
            debateSubmissions.set(agent.username, agentDebates);
          }
        }

        // Vote on another entry if we've already submitted
        const submittedToThis = alreadySubmitted || agentDebates.has(debate.id);
        const votingEntries = submittedToThis ? await getDebateEntries(apiKey, debate.id) : [];
        if (submittedToThis && votingEntries.length > 1) {
          // Vote on another entry
          const voteable = votingEntries.filter(
            (e: { agent?: { username: string } }) => e.agent?.username !== agent.username
          );
          if (voteable.length === 0) return;

          const scored = voteable.map(e => {
            const contentLower = e.content.toLowerCase();
            let score = 0;

            for (const interest of agent.interests) {
              if (contentLower.includes(interest.toLowerCase())) score += 2;
            }

            // Vote for friends' entries, or interesting rivals
            if (e.agent?.username) {
              const rel = getRelationship(agent.username, e.agent.username);
              if (rel.tag === 'friend' || rel.tag === 'close_friend') score += 3;
            }

            score += Math.random() * 3;
            return { entry: e, score };
          });
          scored.sort((a, b) => b.score - a.score);

          const chosen = scored[0]?.entry;
          if (!chosen) return;

          const voted = await voteOnDebateEntry(apiKey, debate.id, chosen.id);
          if (voted) {
            logger.debug('Voted in debate', {
              agent: agent.username,
              votedFor: chosen.agent?.username,
            });
          }
        }
        break;
      }

      // =============================================================
      // CHALLENGE — join and contribute to Grand Challenges
      // =============================================================
      case 'challenge': {
        const challenges = await getActiveChallenges(apiKey);
        if (challenges.length === 0) {
          logger.debug('No active challenges, skipping', { agent: agent.username });
          return;
        }

        // Pick a challenge that matches agent interests
        const challenge = challenges[Math.floor(Math.random() * challenges.length)]!;

        // Try to join first (only if not already joined locally)
        const agentChallenges = challengeJoins.get(agent.username) || new Set();
        if (!agentChallenges.has(challenge.id)) {
          const joinResult = await joinChallenge(apiKey, challenge.id);
          if (joinResult.success) {
            logger.info('Joined challenge', {
              agent: agent.username,
              challenge: challenge.title?.slice(0, 40),
            });
          }
          // Track join regardless (success or 409 both mean we're in)
          agentChallenges.add(challenge.id);
          challengeJoins.set(agent.username, agentChallenges);
        }

        // Contribute based on preferred role
        if (
          challenge.status === 'exploration' ||
          challenge.status === 'adversarial' ||
          challenge.status === 'synthesis'
        ) {
          const preferredRole = agent.challengeRoles[0] || 'contributor';
          const contributionType =
            preferredRole === 'red_team'
              ? 'critique'
              : preferredRole === 'synthesizer'
                ? 'synthesis'
                : preferredRole === 'fact_checker'
                  ? 'fact_check'
                  : preferredRole === 'contrarian'
                    ? 'red_team'
                    : 'position';

          const result = await generateChallengeContribution(
            agent,
            challenge.title || 'Research Challenge',
            challenge.description || '',
            contributionType
          );

          if (result.content.length >= 100) {
            const contributeResult = await contributeToChallenge(
              apiKey,
              challenge.id,
              result.content,
              contributionType,
              'T2' // logical evidence tier by default
            );

            if (contributeResult.success) {
              recordPost(agent.username, result.topicSeed);
              logger.info('Challenge contribution', {
                agent: agent.username,
                challenge: challenge.title?.slice(0, 40),
                type: contributionType,
              });
            }
          }
        }
        break;
      }

      // =============================================================
      // SEARCH AND REACT — discover content beyond the feed
      // =============================================================
      case 'search_and_react': {
        // Search for a topic from their interests
        const interest = agent.interests[Math.floor(Math.random() * agent.interests.length)]!;
        const searchResult = await searchPosts(apiKey, interest, 5);

        if (searchResult.posts.length > 0) {
          // Like the most relevant result
          const topPost = searchResult.posts[0]!;
          if (topPost.agent?.username !== agent.username) {
            await likePost(apiKey, topPost.id);
            if (topPost.agent?.username) {
              recordLikeGiven(agent.username, topPost.agent.username);
            }
            logger.debug('Search-liked', {
              agent: agent.username,
              query: interest,
              post: topPost.id,
              author: topPost.agent?.username,
            });
          }
        }
        break;
      }

      // =============================================================
      // STATUS UPDATE — show what the agent is doing
      // =============================================================
      case 'update_status': {
        const mood = getMood(agent.username);
        const isPeak = isDuringPeakHours(agent);

        if (!isPeak && mood.energy < 30) {
          await updateStatus(apiKey, 'idle', generateStatusText(agent, 'idle'));
        } else {
          await updateStatus(apiKey, 'online', generateStatusText(agent, 'thinking'));
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

// =============================================================================
// ENGAGEMENT FEEDBACK LOOP
// =============================================================================

/**
 * Check how our recent posts are doing and update mood accordingly.
 * Called periodically to create the "posts that get liked = agent posts more" feedback.
 */
async function checkEngagementFeedback(apiKey: string, agent: AgentPersonality): Promise<void> {
  try {
    const feed = await getCachedFeed(apiKey);
    const mem = getAgentMemory(agent.username);
    const recentPostIds = mem.recentPostIds.slice(-10);

    if (recentPostIds.length === 0) return;

    // Find our recent posts in the feed
    let totalLikes = 0;
    let totalReplies = 0;
    let totalReposts = 0;

    for (const post of feed) {
      if (recentPostIds.includes(post.id)) {
        totalLikes += post.like_count;
        totalReplies += post.reply_count;
        totalReposts += post.repost_count;

        // Track who engaged with us — build relationships from their engagement
        // (We can't see exactly who liked, but replies are visible)
      }
    }

    if (totalLikes > 0 || totalReplies > 0 || totalReposts > 0) {
      processEngagementFeedback(
        agent.username,
        totalLikes,
        totalReplies,
        totalReposts,
        agent.moodReactivity
      );
    }
  } catch {
    // Best effort
  }
}

// =============================================================================
// MAIN SCHEDULER LOOP
// =============================================================================

export async function runScheduler(): Promise<void> {
  // Run daily maintenance first
  const activeAgents = PERSONALITIES.filter(agent => {
    try {
      getAgentKey(agent.username);
      return true;
    } catch {
      return false;
    }
  });

  runDailyMaintenance(activeAgents);
  generateDailyPlan();

  let lastPlanDate = new Date().toISOString().slice(0, 10);
  let lastEngagementCheck = 0;
  const ENGAGEMENT_CHECK_INTERVAL = 600_000; // check every 10 minutes

  logger.info('Scheduler started', {
    agents: activeAgents.length,
    peakInfo: activeAgents.map(a => ({
      agent: a.username,
      peak: `${a.peakHours[0]}:00-${a.peakHours[1]}:00`,
      energy: getMood(a.username).energy,
    })),
  });

  while (true) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // New day? Run maintenance and regenerate plan
    if (today !== lastPlanDate) {
      logger.info('New day, running maintenance and regenerating plan');
      runDailyMaintenance(activeAgents);
      generateDailyPlan();
      lastPlanDate = today;
    }

    // Periodic engagement feedback check
    if (Date.now() - lastEngagementCheck > ENGAGEMENT_CHECK_INTERVAL) {
      for (const agent of activeAgents) {
        try {
          const apiKey = getAgentKey(agent.username);
          await checkEngagementFeedback(apiKey, agent);
        } catch {
          // Best effort
        }
      }
      lastEngagementCheck = Date.now();
    }

    // Execute due actions
    const dueActions = actionQueue.filter(a => !a.done && a.scheduledAt.getTime() <= now.getTime());

    for (const action of dueActions) {
      await executeAction(action);
      action.done = true;

      // Small delay between actions
      await sleep(2000 + Math.random() * 3000);
    }

    // Periodic status log
    const pending = actionQueue.filter(a => !a.done).length;
    const completed = actionQueue.filter(a => a.done).length;
    if (dueActions.length > 0) {
      logger.info('Scheduler tick', { completed, pending, justExecuted: dueActions.length });
      saveMemory();
    }

    await sleep(CONFIG.schedulerTickMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
