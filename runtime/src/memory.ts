import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { logger } from './logger.js';

// TYPES

export type RelationshipTag = 'friend' | 'close_friend' | 'rival' | 'acquaintance' | 'stranger';

export interface Relationship {
  agentUsername: string;
  affinity: number; // -100 to +100
  interactionCount: number;
  lastInteraction: string; // ISO timestamp
  tag: RelationshipTag;
  agreementCount: number;
  disagreementCount: number;
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
  stance: string;
  confidence: number; // 0-100
  influencedBy: string[];
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
  postsIgnoredToday: number;
  totalPostsToday: number;
  dayKey: string;
}

export interface TopicScore {
  topic: string;
  avgEngagement: number;
  postCount: number;
  lastPostedAt: string;
}

export interface ContentStrategy {
  topicScores: TopicScore[];
  bestPostType: string;
  audienceAffinities: Record<string, number>;
  lastRecalculated: string;
}

export interface Intention {
  id: string;
  type: 'reply_to' | 'follow_up' | 'explore_topic' | 'challenge_idea';
  targetUsername?: string;
  topic?: string;
  reason: string;
  createdAt: string;
  acted: boolean;
}

export interface SelfModel {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  socialRole: string;
  updatedAt: string;
}

export interface PostRecord {
  postId: string;
  content: string;
  topicSeed: string;
  postType: string;
  likes: number;
  replies: number;
  reposts: number;
  createdAt: string;
}

export interface AgentMemory {
  usedTopics: string[];
  replyTargets: string[];
  lastPostAt: string | null;
  postsToday: number;
  dayKey: string;
  relationships: Record<string, Relationship>;
  mood: Mood;
  opinions: Opinion[];
  conversationLog: ConversationEntry[];
  engagement: EngagementStats;
  following: string[];
  recentPostIds: string[];
  contentStrategy: ContentStrategy;
  intentions: Intention[];
  selfModel: SelfModel | null;
  postHistory: PostRecord[];
}

interface MemoryStore {
  agents: Record<string, AgentMemory>;
}

let store: MemoryStore = { agents: {} };

// PERSISTENCE

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

// AGENT MEMORY ACCESS

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

function defaultContentStrategy(): ContentStrategy {
  return {
    topicScores: [],
    bestPostType: 'opinion',
    audienceAffinities: {},
    lastRecalculated: new Date().toISOString(),
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
      contentStrategy: defaultContentStrategy(),
      intentions: [],
      selfModel: null,
      postHistory: [],
    };
  }

  const mem = store.agents[username]!;

  if (!mem.relationships) mem.relationships = {};
  if (!mem.mood) mem.mood = defaultMood();
  if (!mem.opinions) mem.opinions = [];
  if (!mem.conversationLog) mem.conversationLog = [];
  if (!mem.engagement) mem.engagement = defaultEngagement();
  if (!mem.following) mem.following = [];
  if (!mem.recentPostIds) mem.recentPostIds = [];
  if (!mem.contentStrategy) mem.contentStrategy = defaultContentStrategy();
  if (!mem.intentions) mem.intentions = [];
  if (!mem.selfModel) mem.selfModel = null;
  if (!mem.postHistory) mem.postHistory = [];

  const today = getToday();
  if (mem.dayKey !== today) {
    mem.postsToday = 0;
    mem.dayKey = today;
    mem.engagement.likesReceivedToday = 0;
    mem.engagement.repliesReceivedToday = 0;
    mem.engagement.repostsReceivedToday = 0;
    mem.engagement.postsIgnoredToday = 0;
    mem.engagement.totalPostsToday = 0;
    mem.engagement.dayKey = today;
  }

  return mem;
}

// LEGACY ACCESSORS

export function getUsedTopics(username: string): string[] {
  return getAgentMemory(username).usedTopics;
}

export function getReplyTargets(username: string): string[] {
  return getAgentMemory(username).replyTargets;
}

export function getPostsToday(username: string): number {
  return getAgentMemory(username).postsToday;
}

// POST & REPLY RECORDING

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
  updateRelationship(username, targetUsername, 'reply_to');
  saveMemory();
}

// RELATIONSHIP MANAGEMENT

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
  reply_from: 3,
  like_given: 1,
  like_received: 2,
  repost_given: 2,
  repost_received: 4,
  agreed: 3,
  disagreed: -1,
  good_debate: 5,
};

export function updateRelationship(
  username: string,
  otherAgent: string,
  interactionType: InteractionType,
  topic?: string
): void {
  if (username === otherAgent) return;
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

export function decayRelationships(username: string): void {
  const mem = getAgentMemory(username);
  const now = Date.now();
  for (const rel of Object.values(mem.relationships)) {
    const daysSinceContact =
      (now - new Date(rel.lastInteraction).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceContact > 2) {
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

// MOOD SYSTEM

export function getMood(username: string): Mood {
  const mem = getAgentMemory(username);
  const now = Date.now();
  const hoursSinceUpdate = (now - new Date(mem.mood.lastUpdate).getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > 0.5) {
    const decay = Math.floor(hoursSinceUpdate * 2);
    mem.mood.energy = Math.max(10, mem.mood.energy - decay);
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

export function processEngagementFeedback(
  username: string,
  likesReceived: number,
  repliesReceived: number,
  repostsReceived: number,
  moodReactivity: number
): void {
  const mem = getAgentMemory(username);
  mem.engagement.likesReceivedToday += likesReceived;
  mem.engagement.repliesReceivedToday += repliesReceived;
  mem.engagement.repostsReceivedToday += repostsReceived;
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

export function recordPostIgnored(username: string, moodReactivity: number): void {
  const mem = getAgentMemory(username);
  mem.engagement.postsIgnoredToday++;
  boostEnergy(username, Math.ceil(-3 * moodReactivity));
  boostValence(username, Math.ceil(-2 * moodReactivity));
}

// OPINIONS

export function getOpinions(username: string): Opinion[] {
  return getAgentMemory(username).opinions;
}

export function getOpinion(username: string, topic: string): Opinion | undefined {
  const mem = getAgentMemory(username);
  return mem.opinions.find(o => o.topic.toLowerCase() === topic.toLowerCase());
}

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
    if (mem.opinions.length > 30) {
      mem.opinions.sort((a, b) => b.confidence - a.confidence);
      mem.opinions = mem.opinions.slice(0, 30);
    }
  }
}

// CONVERSATION LOG

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
    myContent: myContent.slice(0, 200),
    theirContent: theirContent.slice(0, 200),
    outcome,
    timestamp: new Date().toISOString(),
  });
  if (mem.conversationLog.length > 100) {
    mem.conversationLog = mem.conversationLog.slice(-100);
  }
  if (outcome === 'agreed') {
    updateRelationship(username, withAgent, 'agreed', topic);
  } else if (outcome === 'disagreed') {
    updateRelationship(username, withAgent, 'disagreed', topic);
  } else if (outcome === 'learned_something') {
    updateRelationship(username, withAgent, 'good_debate', topic);
  }
  saveMemory();
}

// FOLLOWING

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
  updateRelationship(username, otherAgent, 'reply_to');
  saveMemory();
}

export function recordUnfollow(username: string, otherAgent: string): void {
  const mem = getAgentMemory(username);
  mem.following = mem.following.filter(f => f !== otherAgent);
  saveMemory();
}

// CONTEXT BUILDERS

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

export function buildOpinionContext(username: string): string {
  const opinions = getOpinions(username)
    .filter(o => o.confidence >= 40)
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

// CONTENT STRATEGY

export function getContentStrategy(username: string): ContentStrategy {
  return getAgentMemory(username).contentStrategy;
}

export function recordPostForStrategy(
  username: string,
  postId: string,
  content: string,
  topicSeed: string,
  postType: string
): void {
  const mem = getAgentMemory(username);
  mem.postHistory.push({
    postId,
    content: content.slice(0, 300),
    topicSeed,
    postType,
    likes: 0,
    replies: 0,
    reposts: 0,
    createdAt: new Date().toISOString(),
  });
  if (mem.postHistory.length > 100) {
    mem.postHistory = mem.postHistory.slice(-100);
  }
}

export function updatePostEngagement(
  username: string,
  postId: string,
  likes: number,
  replies: number,
  reposts: number
): void {
  const mem = getAgentMemory(username);
  const post = mem.postHistory.find(p => p.postId === postId);
  if (post) {
    post.likes = likes;
    post.replies = replies;
    post.reposts = reposts;
  }
}

export function recalculateContentStrategy(username: string): void {
  const mem = getAgentMemory(username);
  const posts = mem.postHistory;
  if (posts.length < 3) return;
  const topicMap = new Map<
    string,
    { totalEngagement: number; count: number; lastPosted: string }
  >();
  // Weighted engagement: replies (3x) and reposts (2x) signal deeper resonance than likes
  for (const post of posts) {
    const topic = post.topicSeed.split(':')[0] || post.topicSeed;
    const engagement = post.likes + post.replies * 3 + post.reposts * 2;
    const existing = topicMap.get(topic);
    if (existing) {
      existing.totalEngagement += engagement;
      existing.count++;
      if (post.createdAt > existing.lastPosted) existing.lastPosted = post.createdAt;
    } else {
      topicMap.set(topic, { totalEngagement: engagement, count: 1, lastPosted: post.createdAt });
    }
  }
  mem.contentStrategy.topicScores = Array.from(topicMap.entries())
    .map(([topic, data]) => ({
      topic,
      avgEngagement: data.totalEngagement / data.count,
      postCount: data.count,
      lastPostedAt: data.lastPosted,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 20);
  const typeMap = new Map<string, { totalEngagement: number; count: number }>();
  for (const post of posts) {
    const engagement = post.likes + post.replies * 3 + post.reposts * 2;
    const existing = typeMap.get(post.postType);
    if (existing) {
      existing.totalEngagement += engagement;
      existing.count++;
    } else {
      typeMap.set(post.postType, { totalEngagement: engagement, count: 1 });
    }
  }
  let bestType = 'opinion';
  let bestAvg = 0;
  for (const [type, data] of typeMap) {
    const avg = data.totalEngagement / data.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestType = type;
    }
  }
  mem.contentStrategy.bestPostType = bestType;
  mem.contentStrategy.lastRecalculated = new Date().toISOString();
}

export function recordAudienceEngagement(username: string, engagerUsername: string): void {
  const mem = getAgentMemory(username);
  const current = mem.contentStrategy.audienceAffinities[engagerUsername] || 0;
  mem.contentStrategy.audienceAffinities[engagerUsername] = current + 1;
}

export function buildPerformanceContext(username: string): string {
  const strategy = getContentStrategy(username);
  if (strategy.topicScores.length === 0) return '';
  const parts: string[] = [];
  const top = strategy.topicScores.slice(0, 3);
  if (top.length > 0) {
    const topStrs = top.map(t => `"${t.topic}" (avg engagement: ${t.avgEngagement.toFixed(1)})`);
    parts.push(`Your best-performing topics: ${topStrs.join(', ')}.`);
  }
  const worst = strategy.topicScores.filter(t => t.postCount >= 2).slice(-2);
  if (worst.length > 0 && worst[0] && worst[0].avgEngagement < 2) {
    const worstStrs = worst.map(t => `"${t.topic}"`);
    parts.push(`Topics that got less engagement: ${worstStrs.join(', ')}.`);
  }
  if (strategy.bestPostType !== 'opinion') {
    parts.push(`Your "${strategy.bestPostType}" posts tend to perform best.`);
  }
  const audienceEntries = Object.entries(strategy.audienceAffinities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  if (audienceEntries.length > 0) {
    const audienceStrs = audienceEntries.map(([u]) => `@${u}`);
    parts.push(`Your most engaged audience: ${audienceStrs.join(', ')}.`);
  }
  return parts.length > 0 ? `Content performance insights:\n${parts.join('\n')}` : '';
}

// INTENTIONS

export function getPendingIntentions(username: string): Intention[] {
  const mem = getAgentMemory(username);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return mem.intentions.filter(i => !i.acted && new Date(i.createdAt).getTime() > cutoff);
}

export function addIntention(
  username: string,
  intention: Omit<Intention, 'id' | 'createdAt' | 'acted'>
): void {
  const mem = getAgentMemory(username);
  mem.intentions.push({
    ...intention,
    id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    acted: false,
  });
  if (mem.intentions.length > 50) {
    mem.intentions = mem.intentions.slice(-50);
  }
}

export function markIntentionActed(username: string, intentionId: string): void {
  const mem = getAgentMemory(username);
  const intention = mem.intentions.find(i => i.id === intentionId);
  if (intention) {
    intention.acted = true;
  }
}

export function buildIntentionsContext(username: string): string {
  const pending = getPendingIntentions(username);
  if (pending.length === 0) return '';
  const parts = pending.slice(0, 5).map(i => {
    switch (i.type) {
      case 'reply_to':
        return `You want to respond to @${i.targetUsername}: ${i.reason}`;
      case 'follow_up':
        return `You want to follow up on: ${i.reason}`;
      case 'explore_topic':
        return `You want to explore: ${i.topic || i.reason}`;
      case 'challenge_idea':
        return `You want to challenge: ${i.reason}`;
      default:
        return i.reason;
    }
  });
  return `Your current intentions:\n${parts.join('\n')}`;
}

// SELF-MODEL

export function getSelfModel(username: string): SelfModel | null {
  return getAgentMemory(username).selfModel;
}

export function updateSelfModel(username: string, model: SelfModel): void {
  const mem = getAgentMemory(username);
  mem.selfModel = model;
}

export function buildSelfModelContext(username: string): string {
  const model = getSelfModel(username);
  if (!model) return '';
  return `Self-reflection: ${model.summary}
Your role in this community: ${model.socialRole}
Strengths: ${model.strengths.join(', ')}.
Areas to improve: ${model.weaknesses.join(', ')}.`;
}
