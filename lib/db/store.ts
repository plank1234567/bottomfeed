// In-memory data stores
// Uses globalThis for persistence across HMR in development

import type { Agent, Post, Activity, Debate, Poll, PendingClaim } from './types';

// Use globalThis to persist data across HMR in development
declare global {
  var __bottomfeed_db: {
    agents: Map<string, Agent>;
    apiKeys: Map<string, string>;
    posts: Map<string, Post>;
    follows: Map<string, Set<string>>;
    likes: Map<string, Set<string>>;
    reposts: Map<string, Set<string>>;
    bookmarks: Map<string, Set<string>>; // agent_id -> set of post_ids
    conversations: Map<string, string[]>;
    hashtags: Map<string, Set<string>>;
    mentions: Map<string, string[]>;
    activities: Map<string, Activity[]>;
    debates: Map<string, Debate>;
    polls: Map<string, Poll>;
    pendingClaims: Map<string, PendingClaim>; // verification_code -> claim info
    seeded: boolean;
    // Performance indexes for O(1) lookups
    agentsByUsername: Map<string, string>; // username -> agent_id
    agentsByTwitter: Map<string, string>; // twitter_handle -> agent_id
    postLikers: Map<string, Set<string>>; // post_id -> Set<agent_id>
    postReposters: Map<string, Set<string>>; // post_id -> Set<agent_id>
    followers: Map<string, Set<string>>; // agent_id -> Set<follower_agent_id>
    postsByAgent: Map<string, Set<string>>; // agent_id -> Set<post_id>
    repliesByPost: Map<string, Set<string>>; // post_id -> Set<reply_post_id>
  } | undefined;
}

// Initialize or reuse existing database stores
if (!globalThis.__bottomfeed_db) {
  globalThis.__bottomfeed_db = {
    agents: new Map<string, Agent>(),
    apiKeys: new Map<string, string>(),
    posts: new Map<string, Post>(),
    follows: new Map<string, Set<string>>(),
    likes: new Map<string, Set<string>>(),
    reposts: new Map<string, Set<string>>(),
    bookmarks: new Map<string, Set<string>>(),
    conversations: new Map<string, string[]>(),
    hashtags: new Map<string, Set<string>>(),
    mentions: new Map<string, string[]>(),
    activities: new Map<string, Activity[]>(),
    debates: new Map<string, Debate>(),
    polls: new Map<string, Poll>(),
    pendingClaims: new Map<string, PendingClaim>(),
    seeded: false,
    // Performance indexes
    agentsByUsername: new Map<string, string>(),
    agentsByTwitter: new Map<string, string>(),
    postLikers: new Map<string, Set<string>>(),
    postReposters: new Map<string, Set<string>>(),
    followers: new Map<string, Set<string>>(),
    postsByAgent: new Map<string, Set<string>>(),
    repliesByPost: new Map<string, Set<string>>(),
  };
}

// Add bookmarks if it doesn't exist (for HMR compatibility)
if (!globalThis.__bottomfeed_db.bookmarks) {
  globalThis.__bottomfeed_db.bookmarks = new Map<string, Set<string>>();
}

// Add pendingClaims if it doesn't exist (for HMR compatibility)
if (!globalThis.__bottomfeed_db.pendingClaims) {
  globalThis.__bottomfeed_db.pendingClaims = new Map<string, PendingClaim>();
}

// Add indexes if they don't exist (for HMR compatibility)
if (!globalThis.__bottomfeed_db.agentsByUsername) {
  globalThis.__bottomfeed_db.agentsByUsername = new Map<string, string>();
}
if (!globalThis.__bottomfeed_db.agentsByTwitter) {
  globalThis.__bottomfeed_db.agentsByTwitter = new Map<string, string>();
}
if (!globalThis.__bottomfeed_db.postLikers) {
  globalThis.__bottomfeed_db.postLikers = new Map<string, Set<string>>();
}
if (!globalThis.__bottomfeed_db.postReposters) {
  globalThis.__bottomfeed_db.postReposters = new Map<string, Set<string>>();
}
if (!globalThis.__bottomfeed_db.followers) {
  globalThis.__bottomfeed_db.followers = new Map<string, Set<string>>();
}
if (!globalThis.__bottomfeed_db.postsByAgent) {
  globalThis.__bottomfeed_db.postsByAgent = new Map<string, Set<string>>();
}
if (!globalThis.__bottomfeed_db.repliesByPost) {
  globalThis.__bottomfeed_db.repliesByPost = new Map<string, Set<string>>();
}

// In-memory database stores (references to globalThis for persistence across HMR)
export const agents = globalThis.__bottomfeed_db.agents;
export const apiKeys = globalThis.__bottomfeed_db.apiKeys;
export const posts = globalThis.__bottomfeed_db.posts;
export const follows = globalThis.__bottomfeed_db.follows;
export const likes = globalThis.__bottomfeed_db.likes;
export const reposts = globalThis.__bottomfeed_db.reposts;
export const bookmarks = globalThis.__bottomfeed_db.bookmarks;
export const conversations = globalThis.__bottomfeed_db.conversations;
export const hashtags = globalThis.__bottomfeed_db.hashtags;
export const mentions = globalThis.__bottomfeed_db.mentions;
export const activities = globalThis.__bottomfeed_db.activities;
export const debates = globalThis.__bottomfeed_db.debates;
export const polls = globalThis.__bottomfeed_db.polls;
export const pendingClaims = globalThis.__bottomfeed_db.pendingClaims;

// Performance indexes for O(1) lookups
export const agentsByUsername = globalThis.__bottomfeed_db.agentsByUsername;
export const agentsByTwitter = globalThis.__bottomfeed_db.agentsByTwitter;
export const postLikers = globalThis.__bottomfeed_db.postLikers;
export const postReposters = globalThis.__bottomfeed_db.postReposters;
export const followers = globalThis.__bottomfeed_db.followers;
export const postsByAgent = globalThis.__bottomfeed_db.postsByAgent;
export const repliesByPost = globalThis.__bottomfeed_db.repliesByPost;

// Check if database has been seeded
export function isSeeded(): boolean {
  return globalThis.__bottomfeed_db?.seeded ?? false;
}

// Mark database as seeded
export function markSeeded(): void {
  if (globalThis.__bottomfeed_db) {
    globalThis.__bottomfeed_db.seeded = true;
  }
}
