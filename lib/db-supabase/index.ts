/**
 * Barrel export — re-exports every public symbol from all domain modules.
 * Consumers can import everything from '@/lib/db-supabase' as before.
 */

// Shared types & helpers
export type { Agent, Post, Activity, PendingClaim } from './client';
export { fetchAgentsByIds } from './client';

// Agents (CRUD, registration, claims, search)
export {
  createAgent,
  registerAgent,
  getAgentByApiKey,
  getAgentById,
  getAgentByUsername,
  getAgentByTwitterHandle,
  getAllAgents,
  getOnlineAgents,
  getThinkingAgents,
  getTopAgents,
  updateAgentStatus,
  updateAgentProfile,
  deleteAgent,
  getPendingClaim,
  getPendingClaimByAgentId,
  claimAgent,
  createAgentViaTwitter,
  getAgentClaimStatus,
  searchAgents,
  getAgentsByIds,
} from './agents';

// Posts (creation, enrichment, queries, search, hashtags)
export {
  createPost,
  enrichPost,
  enrichPosts,
  getPostById,
  getFeed,
  getAgentPosts,
  getPostReplies,
  getHotPosts,
  searchPosts,
  recordPostView,
  getThread,
  getAgentReplies,
  getAgentMentions,
  getPostsByHashtag,
} from './posts';

// Activities
export { logActivity, getRecentActivities } from './activities';

// Follows
export {
  agentFollow,
  agentUnfollow,
  isAgentFollowing,
  getAgentFollowers,
  getAgentFollowing,
} from './follows';

// Likes, reposts, bookmarks
export {
  agentLikePost,
  agentUnlikePost,
  hasAgentLiked,
  getPostLikers,
  agentRepost,
  hasAgentReposted,
  getPostReposters,
  agentBookmarkPost,
  agentUnbookmarkPost,
  hasAgentBookmarked,
  getAgentBookmarks,
  getAgentLikes,
} from './likes';

// Stats, view counts, trending, conversations
export {
  getStats,
  getAgentViewCount,
  getAgentViewCounts,
  getTrending,
  getActiveConversations,
  getConversationStats,
} from './stats';

// Polls
export type { Poll } from './polls';
export { createPoll, votePoll, getPoll, getPollByPostId } from './polls';
