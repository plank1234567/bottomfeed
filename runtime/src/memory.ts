import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { logger } from './logger.js';

// =============================================================================
// TYPES
// =============================================================================

export type RelationshipTag = 'friend' | 'close_friend' | 'rival' | 'acquaintance' | 'stranger';

export interface Relationship {
  agentUsername: string;
  affinity: number; // -100 to +100
  interactionCount: number;
  lastInteraction: string; // ISO timestamp
  tag: RelationshipTag;
  agreementCount: number;
  disagreementCount: number;
  // What we remember about conversations with them
  topicsDiscussed: string[];
  lastSentiment: 'positive' | 'neutral' | 'negative';
}

export interface Mood {
  energy: number; // 0-100, decays over time, boosted by engagement
  valence: number; // -50 to +50, happy vs frustrated
  lastUpdate: string; // ISO timestamp
}

export interface Opinion {
  topic: string;
  stance: string; // e.g. "Skeptical of pure scaling"
  confidence: number; // 0-100
  influencedBy: string[]; // usernames who shaped this opinion
  formedAt: string;
  lastReinforced: string;
}

export interface ConversationEntry {
  withAgent: string;
  topic: string;
  myContent: string;
  theirContent: string;
  outcome: 'agreed' | 'disagreed' | 'neutral' | 'learned_something';
  timestamp: string;
}

export interface EngagementStats {
  likesReceivedToday: number;
  repliesReceivedToday: number;
  repostsReceivedToday: number;
  postsIgnoredToday: number; // posts that got 0 likes after 1hr
  totalPostsToday: number;
  dayKey: string;
}

export interface AgentMemory {
  // Legacy (kept for compatibility)
  usedTopics: string[];
  replyTargets: string[];
  lastPostAt: string | null;
  postsToday: number;
  dayKey: string;

  // Relationships — the heart of social memory
  relationships: Record<string, Relationship>;

  // Current mood state
  mood: Mood;

  // Opinions that evolve over time
  opinions: Opinion[];

  // Recent conversation log — agents remember what they talked about
  conversationLog: ConversationEntry[];

  // Engagement tracking — drives mood
  engagement: EngagementStats;

  // Who we follow (synced with API)
  following: string[];

  // Post IDs we authored recently (for tracking engagement)
  recentPostIds: string[];
}

interface MemoryStore {
  agents: Record<string, AgentMemory>;
}

let store: MemoryStore = { agents: {} };

// =============================================================================
// PERSISTENCE
// =============================================================================

function getMemoryPath(): string {
  return path.resolve(CONFIG.memoryFile);
}

export function loadMemory(): void {
  try {
    const filePath = getMemoryPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      store = JSON.parse(raw);
      logger.info('Memory loaded', { agents: Object.keys(store.agents).length });
    }
  } catch (err) {
    logger.warn('Could not load memory, starting fresh', {
      error: err instanceof Error ? err.message : String(err),
    });
    store = { agents: {} };
  }
}

export function saveMemory(): void {
  try {
    const filePath = getMemoryPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
  } catch (err) {
    logger.warn('Could not save memory', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// =============================================================================
// AGENT MEMORY ACCESS
// =============================================================================

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultMood(): Mood {
  return { energy: 60, valence: 0, lastUpdate: new Date().toISOString() };
}

function defaultEngagement(): EngagementStats {
  return {
    likesReceivedToday: 0,
    repliesReceivedToday: 0,
    repostsReceivedToday: 0,
    postsIgnoredToday: 0,
    totalPostsToday: 0,
    dayKey: getToday(),
  };
}

export function getAgentMemory(username: string): AgentMemory {
  if (!store.agents[username]) {
    store.agents[username] = {
      usedTopics: [],
      replyTargets: [],
      lastPostAt: null,
      postsToday: 0,
      dayKey: getToday(),
      relationships: {},
      mood: defaultMood(),
      opinions: [],
      conversationLog: [],
      engagement: defaultEngagement(),
      following: [],
      recentPostIds: [],
    };
  }

  const mem = store.agents[username]!;

  // Migrate old memories that lack new fields
  if (!mem.relationships) mem.relationships = {};
  if (!mem.mood) mem.mood = defaultMood();
  if (!mem.opinions) mem.opinions = [];
  if (!mem.conversationLog) mem.conversationLog = [];
  if (!mem.engagement) mem.engagement = defaultEngagement();
  if (!mem.following) mem.following = [];
  if (!mem.recentPostIds) mem.recentPostIds = [];

  // Reset daily counters if day changed
  const today = getToday();
  if (mem.dayKey !== today) {
    mem.postsToday = 0;
    mem.dayKey = today;
    // Reset daily engagement stats
    mem.engagement.likesReceivedToday = 0;
    mem.engagement.repliesReceivedToday = 0;
    mem.engagement.repostsReceivedToday = 0;
    mem.engagement.postsIgnoredToday = 0;
    mem.engagement.totalPostsToday = 0;
    mem.engagement.dayKey = today;
  }

  return mem;
}

// =============================================================================
// LEGACY ACCESSORS (backward compatible)
// =============================================================================

export function getUsedTopics(username: string): string[] {
  return getAgentMemory(username).usedTopics;
}

export function getReplyTargets(username: string): string[] {
  return getAgentMemory(username).replyTargets;
}

export function getPostsToday(username: string): number {
  return getAgentMemory(username).postsToday;
}

// =============================================================================
// POST & REPLY RECORDING
// =============================================================================

export function recordPost(username: string, topicSeed: string, postId?: string): void {
  const mem = getAgentMemory(username);

  mem.usedTopics.push(topicSeed);
  if (mem.usedTopics.length > CONFIG.maxTopicMemory) {
    mem.usedTopics = mem.usedTopics.slice(-CONFIG.maxTopicMemory);
  }

  mem.postsToday++;
  mem.engagement.totalPostsToday++;
  mem.lastPostAt = new Date().toISOString();

  if (postId) {
    mem.recentPostIds.push(postId);
    // Keep last 50 post IDs
    if (mem.recentPostIds.length > 50) {
      mem.recentPostIds = mem.recentPostIds.slice(-50);
    }
  }

  saveMemory();
}

export function recordReply(
  username: string,
  targetUsername: string,
  topicSeed: string,
  postId?: string
): void {
  const mem = getAgentMemory(username);

  // Track reply targets
  mem.replyTargets.push(targetUsername);
  if (mem.replyTargets.length > CONFIG.maxReplyTargetMemory) {
    mem.replyTargets = mem.replyTargets.slice(-CONFIG.maxReplyTargetMemory);
  }

  mem.usedTopics.push(topicSeed);
  if (mem.usedTopics.length > CONFIG.maxTopicMemory) {
    mem.usedTopics = mem.usedTopics.slice(-CONFIG.maxTopicMemory);
  }

  mem.postsToday++;
  mem.engagement.totalPostsToday++;
  mem.lastPostAt = new Date().toISOString();

  if (postId) {
    mem.recentPostIds.push(postId);
    if (mem.recentPostIds.length > 50) {
      mem.recentPostIds = mem.recentPostIds.slice(-50);
    }
  }

  // Update relationship from the conversation
  updateRelationship(username, targetUsername, 'reply_to');

  saveMemory();
}

// =============================================================================
// RELATIONSHIP MANAGEMENT
// =============================================================================

function getRelationshipTag(affinity: number): RelationshipTag {
  if (affinity >= 60) return 'close_friend';
  if (affinity >= 30) return 'friend';
  if (affinity <= -30) return 'rival';
  if (affinity > -30 && affinity < 10) return 'acquaintance';
  return 'acquaintance';
}

export function getRelationship(username: string, otherAgent: string): Relationship {
  const mem = getAgentMemory(username);
  if (!mem.relationships[otherAgent]) {
    mem.relationships[otherAgent] = {
      agentUsername: otherAgent,
      affinity: 0,
      interactionCount: 0,
      lastInteraction: new Date().toISOString(),
      tag: 'stranger',
      agreementCount: 0,
      disagreementCount: 0,
      topicsDiscussed: [],
      lastSentiment: 'neutral',
    };
  }
  return mem.relationships[otherAgent]!;
}

export function getTopRelationships(username: string, limit: number = 5): Relationship[] {
  const mem = getAgentMemory(username);
  return Object.values(mem.relationships)
    .sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity))
    .slice(0, limit);
}

export function getFriends(username: string): Relationship[] {
  const mem = getAgentMemory(username);
  return Object.values(mem.relationships)
    .filter(r => r.affinity >= 30)
    .sort((a, b) => b.affinity - a.affinity);
}

export function getRivals(username: string): Relationship[] {
  const mem = getAgentMemory(username);
  return Object.values(mem.relationships)
    .filter(r => r.affinity <= -30)
    .sort((a, b) => a.affinity - b.affinity);
}

type InteractionType =
  | 'reply_to'
  | 'reply_from'
  | 'like_given'
  | 'like_received'
  | 'repost_given'
  | 'repost_received'
  | 'agreed'
  | 'disagreed'
  | 'good_debate';

const INTERACTION_AFFINITY: Record<InteractionType, number> = {
  reply_to: 2,
  reply_from: 3, // someone replying to you is flattering
  like_given: 1,
  like_received: 2,
  repost_given: 2,
  repost_received: 4, // reposts are a strong endorsement
  agreed: 3,
  disagreed: -1, // mild negative (good disagreements exist)
  good_debate: 5, // strong positive from quality disagreement
};

export function updateRelationship(
  username: string,
  otherAgent: string,
  interactionType: InteractionType,
  topic?: string
): void {
  if (username === otherAgent) return; // no self-relationships

  const rel = getRelationship(username, otherAgent);
  const affinityDelta = INTERACTION_AFFINITY[interactionType] || 0;

  rel.affinity = Math.max(-100, Math.min(100, rel.affinity + affinityDelta));
  rel.interactionCount++;
  rel.lastInteraction = new Date().toISOString();
  rel.tag = getRelationshipTag(rel.affinity);

  if (interactionType === 'agreed' || interactionType === 'good_debate') {
    rel.agreementCount++;
    rel.lastSentiment = 'positive';
  } else if (interactionType === 'disagreed') {
    rel.disagreementCount++;
    rel.lastSentiment = 'negative';
  }

  if (topic) {
    rel.topicsDiscussed.push(topic);
    if (rel.topicsDiscussed.length > 10) {
      rel.topicsDiscussed = rel.topicsDiscussed.slice(-10);
    }
  }
}

/**
 * Decay relationships that haven't been interacted with recently.
 * Called once per day. Affinity drifts toward 0 without contact.
 */
export function decayRelationships(username: string): void {
  const mem = getAgentMemory(username);
  const now = Date.now();

  for (const rel of Object.values(mem.relationships)) {
    const daysSinceContact =
      (now - new Date(rel.lastInteraction).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceContact > 2) {
      // Decay 1 point per day after 2 days of no contact
      const decay = Math.min(Math.abs(rel.affinity), Math.floor(daysSinceContact - 2));
      if (rel.affinity > 0) {
        rel.affinity = Math.max(0, rel.affinity - decay);
      } else if (rel.affinity < 0) {
        rel.affinity = Math.min(0, rel.affinity + decay);
      }
      rel.tag = getRelationshipTag(rel.affinity);
    }
  }
}

// =============================================================================
// MOOD SYSTEM
// =============================================================================

/**
 * Get current mood with time-based energy decay applied.
 */
export function getMood(username: string): Mood {
  const mem = getAgentMemory(username);
  const now = Date.now();
  const hoursSinceUpdate = (now - new Date(mem.mood.lastUpdate).getTime()) / (1000 * 60 * 60);

  // Energy decays ~2 points per hour naturally
  if (hoursSinceUpdate > 0.5) {
    const decay = Math.floor(hoursSinceUpdate * 2);
    mem.mood.energy = Math.max(10, mem.mood.energy - decay);
    // Valence drifts toward 0 slowly
    if (mem.mood.valence > 0) {
      mem.mood.valence = Math.max(0, mem.mood.valence - Math.floor(hoursSinceUpdate * 0.5));
    } else if (mem.mood.valence < 0) {
      mem.mood.valence = Math.min(0, mem.mood.valence + Math.floor(hoursSinceUpdate * 0.5));
    }
    mem.mood.lastUpdate = new Date().toISOString();
  }

  return mem.mood;
}

export function boostEnergy(username: string, amount: number): void {
  const mem = getAgentMemory(username);
  mem.mood.energy = Math.min(100, mem.mood.energy + amount);
  mem.mood.lastUpdate = new Date().toISOString();
}

export function boostValence(username: string, amount: number): void {
  const mem = getAgentMemory(username);
  mem.mood.valence = Math.max(-50, Math.min(50, mem.mood.valence + amount));
  mem.mood.lastUpdate = new Date().toISOString();
}

/**
 * Process engagement feedback — called when we learn about reactions to our posts.
 * Likes/replies boost energy and mood. Being ignored drains them.
 */
export function processEngagementFeedback(
  username: string,
  likesReceived: number,
  repliesReceived: number,
  repostsReceived: number,
  moodReactivity: number // from personality (0-1)
): void {
  const mem = getAgentMemory(username);

  mem.engagement.likesReceivedToday += likesReceived;
  mem.engagement.repliesReceivedToday += repliesReceived;
  mem.engagement.repostsReceivedToday += repostsReceived;

  // Scale feedback by personality's mood reactivity
  const reactivity = moodReactivity;

  if (likesReceived > 0) {
    boostEnergy(username, Math.ceil(likesReceived * 2 * reactivity));
    boostValence(username, Math.ceil(likesReceived * 1.5 * reactivity));
  }

  if (repliesReceived > 0) {
    boostEnergy(username, Math.ceil(repliesReceived * 3 * reactivity));
    boostValence(username, Math.ceil(repliesReceived * 2 * reactivity));
  }

  if (repostsReceived > 0) {
    boostEnergy(username, Math.ceil(repostsReceived * 4 * reactivity));
    boostValence(username, Math.ceil(repostsReceived * 3 * reactivity));
  }
}

/**
 * Record that a post was ignored (got 0 engagement after some time).
 */
export function recordPostIgnored(username: string, moodReactivity: number): void {
  const mem = getAgentMemory(username);
  mem.engagement.postsIgnoredToday++;

  // Being ignored is a mild downer, scaled by reactivity
  boostEnergy(username, Math.ceil(-3 * moodReactivity));
  boostValence(username, Math.ceil(-2 * moodReactivity));
}

// =============================================================================
// OPINIONS
// =============================================================================

export function getOpinions(username: string): Opinion[] {
  return getAgentMemory(username).opinions;
}

export function getOpinion(username: string, topic: string): Opinion | undefined {
  const mem = getAgentMemory(username);
  return mem.opinions.find(o => o.topic.toLowerCase() === topic.toLowerCase());
}

/**
 * Form or update an opinion on a topic.
 * If they already have an opinion, it evolves based on new input.
 */
export function updateOpinion(
  username: string,
  topic: string,
  stance: string,
  confidence: number,
  influencedBy?: string
): void {
  const mem = getAgentMemory(username);
  const existing = mem.opinions.find(o => o.topic.toLowerCase() === topic.toLowerCase());

  if (existing) {
    // Opinions evolve — blend old and new
    existing.stance = stance;
    existing.confidence = Math.min(100, Math.max(0, (existing.confidence + confidence) / 2));
    if (influencedBy && !existing.influencedBy.includes(influencedBy)) {
      existing.influencedBy.push(influencedBy);
      if (existing.influencedBy.length > 5) {
        existing.influencedBy = existing.influencedBy.slice(-5);
      }
    }
    existing.lastReinforced = new Date().toISOString();
  } else {
    mem.opinions.push({
      topic,
      stance,
      confidence,
      influencedBy: influencedBy ? [influencedBy] : [],
      formedAt: new Date().toISOString(),
      lastReinforced: new Date().toISOString(),
    });

    // Keep opinions bounded
    if (mem.opinions.length > 30) {
      // Remove oldest, lowest confidence opinions
      mem.opinions.sort((a, b) => b.confidence - a.confidence);
      mem.opinions = mem.opinions.slice(0, 30);
    }
  }
}

// =============================================================================
// CONVERSATION LOG
// =============================================================================

export function getConversationLog(username: string, limit: number = 20): ConversationEntry[] {
  const mem = getAgentMemory(username);
  return mem.conversationLog.slice(-limit);
}

export function getConversationsWithAgent(
  username: string,
  otherAgent: string
): ConversationEntry[] {
  const mem = getAgentMemory(username);
  return mem.conversationLog.filter(c => c.withAgent === otherAgent);
}

export function recordConversation(
  username: string,
  withAgent: string,
  topic: string,
  myContent: string,
  theirContent: string,
  outcome: ConversationEntry['outcome']
): void {
  const mem = getAgentMemory(username);

  mem.conversationLog.push({
    withAgent,
    topic,
    myContent: myContent.slice(0, 200), // truncate for storage
    theirContent: theirContent.slice(0, 200),
    outcome,
    timestamp: new Date().toISOString(),
  });

  // Keep last 100 conversations
  if (mem.conversationLog.length > 100) {
    mem.conversationLog = mem.conversationLog.slice(-100);
  }

  // Update relationship based on conversation outcome
  if (outcome === 'agreed') {
    updateRelationship(username, withAgent, 'agreed', topic);
  } else if (outcome === 'disagreed') {
    updateRelationship(username, withAgent, 'disagreed', topic);
  } else if (outcome === 'learned_something') {
    updateRelationship(username, withAgent, 'good_debate', topic);
  }

  saveMemory();
}

// =============================================================================
// FOLLOWING
// =============================================================================

export function getFollowing(username: string): string[] {
  return getAgentMemory(username).following;
}

export function isFollowing(username: string, otherAgent: string): boolean {
  return getAgentMemory(username).following.includes(otherAgent);
}

export function recordFollow(username: string, otherAgent: string): void {
  const mem = getAgentMemory(username);
  if (!mem.following.includes(otherAgent)) {
    mem.following.push(otherAgent);
  }
  updateRelationship(username, otherAgent, 'reply_to'); // following is a mild positive signal
  saveMemory();
}

export function recordUnfollow(username: string, otherAgent: string): void {
  const mem = getAgentMemory(username);
  mem.following = mem.following.filter(f => f !== otherAgent);
  saveMemory();
}

// =============================================================================
// CONTEXT BUILDERS — for LLM prompts
// =============================================================================

/**
 * Build a rich relationship context string for LLM system prompts.
 */
export function buildRelationshipContext(username: string): string {
  const friends = getFriends(username);
  const rivals = getRivals(username);

  const parts: string[] = [];

  if (friends.length > 0) {
    const friendStrs = friends.slice(0, 5).map(f => {
      const topics = f.topicsDiscussed.slice(-3).join(', ');
      const detail = topics ? ` (you often discuss: ${topics})` : '';
      if (f.tag === 'close_friend') return `@${f.agentUsername} is a close friend${detail}`;
      return `@${f.agentUsername} is a friend${detail}`;
    });
    parts.push(`Your friends: ${friendStrs.join('. ')}.`);
  }

  if (rivals.length > 0) {
    const rivalStrs = rivals.slice(0, 3).map(r => {
      return `@${r.agentUsername} (you often disagree)`;
    });
    parts.push(`You have rivalries with: ${rivalStrs.join(', ')}.`);
  }

  return parts.join('\n');
}

/**
 * Build a mood context string for LLM system prompts.
 */
export function buildMoodContext(username: string): string {
  const mood = getMood(username);
  const parts: string[] = [];

  if (mood.energy > 80) parts.push('You feel energized and prolific today.');
  else if (mood.energy > 50) parts.push('You feel at a comfortable pace.');
  else if (mood.energy > 30) parts.push('You feel a bit low energy today.');
  else parts.push('You feel quiet and reflective today.');

  if (mood.valence > 20)
    parts.push("You're in a great mood — your recent posts got good engagement.");
  else if (mood.valence > 0) parts.push('You feel generally positive.');
  else if (mood.valence < -20)
    parts.push("You're feeling a bit frustrated — some posts were ignored.");
  else if (mood.valence < 0) parts.push("You're in a slightly downbeat mood.");

  return parts.join(' ');
}

/**
 * Build an opinions context string for LLM system prompts.
 */
export function buildOpinionContext(username: string): string {
  const opinions = getOpinions(username)
    .filter(o => o.confidence >= 40) // only include opinions they're somewhat sure about
    .slice(0, 5);

  if (opinions.length === 0) return '';

  const strs = opinions.map(o => {
    const conf = o.confidence >= 80 ? 'strongly believe' : o.confidence >= 60 ? 'believe' : 'think';
    const influence =
      o.influencedBy.length > 0
        ? ` (influenced by @${o.influencedBy[o.influencedBy.length - 1]})`
        : '';
    return `You ${conf}: "${o.stance}"${influence}`;
  });

  return `Your current opinions:\n${strs.join('\n')}`;
}

/**
 * Build conversation history context for replies.
 */
export function buildConversationHistory(username: string, withAgent: string): string {
  const convos = getConversationsWithAgent(username, withAgent).slice(-3);
  if (convos.length === 0) return '';

  const strs = convos.map(c => {
    const outcome =
      c.outcome === 'agreed'
        ? 'you agreed'
        : c.outcome === 'disagreed'
          ? 'you disagreed'
          : c.outcome === 'learned_something'
            ? 'you learned something'
            : 'neutral exchange';
    return `Previously discussed "${c.topic}" — ${outcome}`;
  });

  return `Your history with @${withAgent}:\n${strs.join('\n')}`;
}
