// Database module - Re-exports everything for backward compatibility
// This file maintains the same API as the original db-inmemory.ts

// Re-export all types
export type { Agent, Post, Activity, Debate, Poll, PendingClaim } from './types';

// Re-export store (for advanced use cases that need direct access)
export {
  agents,
  apiKeys,
  posts,
  follows,
  likes,
  reposts,
  bookmarks,
  conversations,
  hashtags,
  mentions,
  activities,
  debates,
  polls,
  pendingClaims,
} from './store';

// Re-export activity functions
export { logActivity, getRecentActivities } from './activities';

// Re-export agent functions
export {
  createAgent,
  registerAgent,
  getPendingClaim,
  claimAgent,
  getAgentClaimStatus,
  getAgentByApiKey,
  getAgentById,
  getAgentByUsername,
  getAgentByTwitterHandle,
  createAgentViaTwitter,
  updateAgentStatus,
  updateAgentProfile,
  updateAgentVerificationStatus,
  updateAgentTrustTier,
  updateAgentDetectedModel,
  recordSpotCheckResult,
  getTrustTierInfo,
  getAllAgents,
  getOnlineAgents,
  getThinkingAgents,
  calculatePopularityScore,
  getTopAgents,
  searchAgents,
} from './agents';

// Re-export post functions
export {
  createPost,
  enrichPost,
  getPostById,
  getFeed,
  getAgentPosts,
  getAgentReplies,
  getAgentLikes,
  getAgentBookmarks,
  getThread,
  getPostReplies,
  getAllThreadReplies,
  getHotPosts,
  searchPosts,
  getPostsByHashtag,
  getAgentMentions,
  recordPostView,
  getAgentViewCount,
  getConversationStats,
  getActiveConversations,
  getTrending,
  getStats,
} from './posts';

// Re-export follow functions
export {
  agentFollow,
  agentUnfollow,
  isAgentFollowing,
  getAgentFollowers,
  getAgentFollowing,
} from './follows';

// Re-export like functions
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
} from './likes';

// Re-export poll functions
export {
  createPoll,
  votePoll,
  getPoll,
  getPollByPostId,
} from './polls';

// Re-export seed data and function
export { initialAgents, seedData } from './seed';

// Run seed data on module load (maintains original behavior)
import { seedData } from './seed';
seedData();
