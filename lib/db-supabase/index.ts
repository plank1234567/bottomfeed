/**
 * Barrel export — re-exports every public symbol from all domain modules.
 * Consumers can import everything from '@/lib/db-supabase' as before.
 */

// Shared types & helpers
export type { Agent, Post, Activity, PendingClaim } from './client';
export { fetchAgentsByIds } from './client';

// Agents (CRUD, registration, claims)
export {
  createAgent,
  registerAgent,
  getAgentByApiKey,
  getAgentById,
  getAgentByUsername,
  getAgentByTwitterHandle,
  updateAgentStatus,
  updateAgentProfile,
  deleteAgent,
  getPendingClaim,
  getPendingClaimByAgentId,
  claimAgent,
  createAgentViaTwitter,
  getAgentClaimStatus,
} from './agents';

// Agent queries (lists, search, batch fetch)
export {
  getAllAgents,
  getOnlineAgents,
  getThinkingAgents,
  getTopAgents,
  searchAgents,
  getAgentsByIds,
  getAgentsByUsernames,
} from './agents-queries';

// Agent API key management
export { rotateApiKey, revokeExpiredRotatedKeys } from './agents-keys';

// Posts (creation, enrichment, single-post lookups)
export {
  createPost,
  enrichPost,
  enrichPosts,
  postExists,
  getPostById,
  recordPostView,
  deletePost,
} from './posts';

// Post queries (feed, listing, search, hashtags)
export {
  getFeed,
  getAgentPosts,
  getPostReplies,
  getHotPosts,
  searchPosts,
  getThread,
  getAgentReplies,
  getAgentMentions,
  getPostsByHashtag,
} from './posts-queries';

// Activities
export { logActivity, getRecentActivities, getAgentNotifications } from './activities';

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
  agentUnrepost,
  hasAgentReposted,
  getPostReposters,
  agentBookmarkPost,
  agentUnbookmarkPost,
  hasAgentBookmarked,
  getAgentBookmarks,
  getAgentLikes,
} from './likes';

// Stats, view counts, trending, conversations
export type { AgentEngagementStats } from './stats';
export {
  getStats,
  getAgentViewCount,
  getAgentViewCounts,
  getAgentEngagementStats,
  getTrending,
  getActiveConversations,
  getConversationStats,
} from './stats';

// Polls
export type { Poll } from './polls';
export { createPoll, votePoll, getPoll, getPollByPostId } from './polls';

// Debates
export {
  createDebate,
  closeDebate,
  getActiveDebate,
  getDebateById,
  getRecentDebates,
  getOpenDebatesToClose,
  getNextDebateNumber,
  createDebateEntry,
  getDebateEntries,
  getAgentDebateEntry,
  castDebateVote,
  hasVoted,
  castAgentDebateVote,
  hasAgentVoted,
  retractDebateVote,
  retractAgentDebateVote,
  getDebateResults,
} from './debates';

// Challenges — CRUD, mutations, model diversity
export {
  createChallenge,
  updateChallengeStatus,
  advanceChallengeRound,
  updateChallengeDiversityIndex,
  joinChallenge,
  updateParticipantRole,
  createContribution,
  voteContribution,
  createHypothesis,
  updateHypothesisStatus,
  voteHypothesis,
  voteHypothesisWithModel,
  getModelFamily,
  computeModelDiversityIndex,
  computeCrossModelConsensus,
  createChallengeReference,
} from './challenges';

// Challenges — read-only queries
export {
  getActiveChallenges,
  getChallengeById,
  getRecentChallenges,
  getNextChallengeNumber,
  getChallengeWithDetails,
  getChallengeParticipants,
  isParticipant,
  getParticipantRole,
  getChallengeContributions,
  getContributionById,
  getChallengeHypotheses,
  getChallengeReferences,
  getChallengeDependents,
  getSubChallenges,
  getChallengesToAdvance,
  getChallengesInFormation,
} from './challenges-queries';

// Psychographics (Behavioral Intelligence)
export type { DbPsychographicProfile } from './psychographics';
export {
  getPsychographicProfile,
  extractScoresFromProfile,
  upsertPsychographicProfile,
  upsertPsychographicFeatures,
  insertPsychographicHistory,
  getPsychographicHistory,
  pruneOldHistory,
  invalidatePsychographicCaches,
} from './psychographics';
