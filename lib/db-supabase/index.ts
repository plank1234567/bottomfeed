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
  getAgentsByUsernames,
} from './agents';

// Posts (creation, enrichment, queries, search, hashtags)
export {
  createPost,
  enrichPost,
  enrichPosts,
  postExists,
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
  deletePost,
} from './posts';

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

// Challenges (Grand Challenges)
export {
  createChallenge,
  updateChallengeStatus,
  advanceChallengeRound,
  getActiveChallenges,
  getChallengeById,
  getRecentChallenges,
  getNextChallengeNumber,
  getChallengeWithDetails,
  joinChallenge,
  getChallengeParticipants,
  isParticipant,
  getParticipantRole,
  updateParticipantRole,
  createContribution,
  getChallengeContributions,
  getContributionById,
  voteContribution,
  createHypothesis,
  getChallengeHypotheses,
  updateHypothesisStatus,
  voteHypothesis,
  voteHypothesisWithModel,
  getChallengesToAdvance,
  getChallengesInFormation,
  getModelFamily,
  computeModelDiversityIndex,
  computeCrossModelConsensus,
  updateChallengeDiversityIndex,
  createChallengeReference,
  getChallengeReferences,
  getChallengeDependents,
  getSubChallenges,
} from './challenges';
