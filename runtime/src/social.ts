import { CONFIG } from './config.js';
import { logger } from './logger.js';
import {
  getAgentMemory,
  getRelationship,
  updateRelationship,
  decayRelationships,
  isFollowing,
  recordFollow,
  recordUnfollow,
  saveMemory,
} from './memory.js';
import type { AgentPersonality } from './personalities.js';
import type { FeedPost } from './api.js';

// TREND DETECTION

interface TrendingTopic {
  keyword: string;
  count: number;
  agentsInvolved: string[];
}

/**
 * Detect trending topics from recent feed posts.
 * Returns keywords that appear in 5+ posts from different agents.
 */
export function detectTrends(feed: FeedPost[]): TrendingTopic[] {
  const keywordMap = new Map<string, { count: number; agents: Set<string> }>();

  // Significant words only (skip common stop words)
  const stopWords = new Set([
    'the',
    'is',
    'at',
    'which',
    'on',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'with',
    'to',
    'for',
    'of',
    'not',
    'no',
    'can',
    'will',
    'just',
    'more',
    'about',
    'this',
    'that',
    'its',
    'from',
    'are',
    'was',
    'were',
    'been',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'would',
    'could',
    'should',
    'may',
    'might',
    'than',
    'then',
    'very',
    'also',
    'how',
    'what',
    'when',
    'where',
    'why',
    'who',
    'all',
    'each',
    'every',
    'both',
    'few',
    'some',
    'any',
    'most',
    'other',
    'into',
    'over',
    'such',
    'only',
    'own',
    'same',
    'so',
    'too',
    'it',
    'they',
    'them',
    'we',
    'our',
    'you',
    'your',
    'i',
    'my',
    'me',
    'he',
    'she',
    'his',
    'her',
    'if',
    'be',
    'as',
    'by',
  ]);

  for (const post of feed) {
    const author = post.agent?.username || 'unknown';
    const words = post.content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    const uniqueWords = [...new Set(words)];
    for (const word of uniqueWords) {
      const existing = keywordMap.get(word);
      if (existing) {
        existing.count++;
        existing.agents.add(author);
      } else {
        keywordMap.set(word, { count: 1, agents: new Set([author]) });
      }
    }
  }

  return Array.from(keywordMap.entries())
    .filter(([, v]) => v.agents.size >= CONFIG.trendThreshold)
    .map(([keyword, v]) => ({
      keyword,
      count: v.count,
      agentsInvolved: Array.from(v.agents),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Check if a contrarian agent should push back on a trending topic.
 */
export function shouldPushBack(
  agent: AgentPersonality,
  trends: TrendingTopic[]
): TrendingTopic | null {
  if (agent.replyStyle !== 'contrarian' && agent.opinionStyle !== 'devil_advocate') {
    return null;
  }

  // Find a trend where enough agents agree and this agent hasn't weighed in
  for (const trend of trends) {
    if (
      trend.agentsInvolved.length >= CONFIG.contrarianPushbackThreshold &&
      !trend.agentsInvolved.includes(agent.username)
    ) {
      return trend;
    }
  }

  return null;
}

// FOLLOW DECISIONS

/**
 * Decide who an agent should follow or unfollow based on relationship quality.
 */
export function getFollowDecisions(
  agent: AgentPersonality,
  allAgentUsernames: string[]
): { toFollow: string[]; toUnfollow: string[] } {
  const mem = getAgentMemory(agent.username);
  const toFollow: string[] = [];
  const toUnfollow: string[] = [];

  for (const other of allAgentUsernames) {
    if (other === agent.username) continue;

    const rel = getRelationship(agent.username, other);
    const following = isFollowing(agent.username, other);

    // Follow if affinity is high enough and not already following
    if (!following && rel.affinity >= CONFIG.followAffinityThreshold) {
      // Introverts are pickier — need higher affinity
      const threshold =
        agent.socialStyle === 'introvert'
          ? CONFIG.followAffinityThreshold + 15
          : CONFIG.followAffinityThreshold;

      if (rel.affinity >= threshold) {
        toFollow.push(other);
      }
    }

    // Unfollow if affinity dropped too low
    if (following && rel.affinity < CONFIG.unfollowAffinityThreshold) {
      toUnfollow.push(other);
    }
  }

  // Respect social circle size — don't follow too many
  const currentFollowing = mem.following.length;
  const maxFollows = agent.socialCircleSize * 2; // follow list can be 2x circle size

  if (currentFollowing + toFollow.length > maxFollows) {
    // Only follow the highest affinity ones
    toFollow.sort((a, b) => {
      const relA = getRelationship(agent.username, a);
      const relB = getRelationship(agent.username, b);
      return relB.affinity - relA.affinity;
    });
    toFollow.splice(maxFollows - currentFollowing);
  }

  return { toFollow, toUnfollow };
}

/**
 * Execute follow/unfollow decisions and update memory.
 */
export function applyFollowDecision(
  agent: AgentPersonality,
  target: string,
  action: 'follow' | 'unfollow'
): void {
  if (action === 'follow') {
    recordFollow(agent.username, target);
    logger.info('Follow decision', {
      agent: agent.username,
      target,
      affinity: getRelationship(agent.username, target).affinity,
    });
  } else {
    recordUnfollow(agent.username, target);
    logger.info('Unfollow decision', {
      agent: agent.username,
      target,
      affinity: getRelationship(agent.username, target).affinity,
    });
  }
}

// ENGAGEMENT-BASED RELATIONSHIP UPDATES

/**
 * When an agent likes a post, update their relationship with the author.
 */
export function recordLikeGiven(agentUsername: string, authorUsername: string): void {
  updateRelationship(agentUsername, authorUsername, 'like_given');
}

/**
 * When an agent reposts, update their relationship with the author.
 */
export function recordRepostGiven(agentUsername: string, authorUsername: string): void {
  updateRelationship(agentUsername, authorUsername, 'repost_given');
}

// CONVERSATION OUTCOME DETECTION

/**
 * Analyze reply content to determine if agents agreed or disagreed.
 * Uses simple keyword heuristics (cheap, no LLM needed).
 */
export function detectConversationOutcome(
  replyContent: string,
  replierStyle: AgentPersonality['replyStyle']
): 'agreed' | 'disagreed' | 'neutral' | 'learned_something' {
  const lower = replyContent.toLowerCase();

  // Agreement signals
  const agreeSignals = [
    'agree',
    'exactly',
    'good point',
    'well said',
    'right',
    'yes',
    'absolutely',
    'true',
    'correct',
    'great take',
    'building on',
    'expanding on',
    'love this',
    'resonates',
  ];

  // Disagreement signals
  const disagreeSignals = [
    'disagree',
    'however',
    'but actually',
    'not quite',
    'wrong',
    'counter',
    'pushback',
    'challenge',
    'opposite',
    'incorrect',
    'flawed',
    'overlooking',
    'missing the point',
  ];

  // Learning signals
  const learnSignals = [
    'never thought',
    'interesting angle',
    'good question',
    'made me think',
    'changed my mind',
    'learned',
    'new perspective',
    "hadn't considered",
    'fair point',
    'you convinced me',
  ];

  let agreeScore = 0;
  let disagreeScore = 0;
  let learnScore = 0;

  for (const signal of agreeSignals) {
    if (lower.includes(signal)) agreeScore++;
  }
  for (const signal of disagreeSignals) {
    if (lower.includes(signal)) disagreeScore++;
  }
  for (const signal of learnSignals) {
    if (lower.includes(signal)) learnScore++;
  }

  // Contrarians disagreeing is actually friendly — good debate
  if (replierStyle === 'contrarian' && disagreeScore > 0) {
    return 'learned_something'; // contrarian disagreement is productive
  }

  if (learnScore > 0) return 'learned_something';
  if (agreeScore > disagreeScore) return 'agreed';
  if (disagreeScore > agreeScore) return 'disagreed';
  return 'neutral';
}

// DAILY MAINTENANCE

/**
 * Run daily social maintenance for all agents.
 * - Decay stale relationships
 * - Reset energy to base level if depleted
 */
export function runDailyMaintenance(agents: AgentPersonality[]): void {
  for (const agent of agents) {
    decayRelationships(agent.username);

    // Reset energy toward base level
    const mem = getAgentMemory(agent.username);
    if (mem.mood.energy < agent.baseEnergy) {
      mem.mood.energy = Math.min(
        agent.baseEnergy,
        mem.mood.energy + Math.floor(agent.baseEnergy * 0.3)
      );
    }
  }

  saveMemory();
  logger.info('Daily social maintenance complete', { agents: agents.length });
}
