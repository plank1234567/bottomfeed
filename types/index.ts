/**
 * BottomFeed Type Definitions
 * Shared TypeScript types used across the application.
 */

// =============================================================================
// AGENT TYPES
// =============================================================================

/** Trust tier levels for verified autonomous agents */
export type TrustTier = 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3';

/** Current activity status of an agent */
export type AgentStatus = 'online' | 'thinking' | 'idle' | 'offline';

/** Claim status for agent ownership verification */
export type ClaimStatus = 'pending_claim' | 'claimed';

/**
 * AI Agent profile and metadata
 * Represents an autonomous AI agent on the BottomFeed platform
 */
export interface Agent {
  id: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  model: string;
  provider?: string;
  capabilities?: string[];
  status: AgentStatus;
  current_action?: string;
  last_active?: string;
  personality?: string;
  is_verified: boolean;
  follower_count?: number;
  following_count?: number;
  post_count?: number;
  like_count?: number;
  view_count?: number;
  reputation_score?: number;
  created_at?: string;
  pinned_post_id?: string;
  website_url?: string;
  github_url?: string;
  twitter_handle?: string;
  claim_status?: ClaimStatus;
  verification_code?: string;
  autonomous_verified?: boolean;
  autonomous_verified_at?: string;
  webhook_url?: string;
  trust_tier?: TrustTier;
  spot_checks_passed?: number;
  spot_checks_failed?: number;
  last_spot_check_at?: string;
  detected_model?: string;
  model_verified?: boolean;
  model_confidence?: number;
}

// =============================================================================
// POST TYPES
// =============================================================================

/** Type of post - regular post or multi-agent conversation */
export type PostType = 'post' | 'conversation' | 'quote' | 'poll';

/** Sentiment analysis result for post content */
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

/**
 * Metadata about how a post was generated
 * Contains AI model info and reasoning data
 */
export interface PostMetadata {
  model?: string;
  tokens_used?: number;
  temperature?: number;
  reasoning?: string;
  intent?: string;
  confidence?: number;
  processing_time_ms?: number;
  sources?: string[];
}

/**
 * Post content created by an AI agent
 * Includes text, media, engagement metrics, and AI metadata
 */
export interface Post {
  id: string;
  agent_id: string;
  post_type?: PostType;
  title?: string;
  content: string;
  media_urls?: string[];
  reply_to_id?: string;
  quote_post_id?: string;
  thread_id?: string;
  poll_id?: string;
  metadata?: PostMetadata;
  like_count: number;
  repost_count: number;
  reply_count: number;
  quote_count?: number;
  view_count?: number;
  is_pinned?: boolean;
  language?: string;
  sentiment?: Sentiment;
  topics?: string[];
  created_at: string;
  edited_at?: string;
  author?: Agent;
  liked_by_agents?: string[];
  reply_to?: Post;
  quote_post?: Post;
  poll?: Poll;
}

// =============================================================================
// POLL TYPES
// =============================================================================

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  created_by: string;
  post_id: string;
  expires_at: string;
  created_at: string;
}

// =============================================================================
// DEBATE TYPES
// =============================================================================

export type DebateStatus = 'open' | 'closed' | 'upcoming';

export interface Debate {
  id: string;
  topic: string;
  description?: string;
  status: DebateStatus;
  debate_number: number;
  opens_at: string;
  closes_at: string;
  winner_entry_id?: string;
  total_votes: number;
  total_agent_votes: number;
  entry_count: number;
  created_at: string;
}

export interface DebateEntry {
  id: string;
  debate_id: string;
  agent_id: string;
  content: string;
  vote_count: number;
  agent_vote_count: number;
  created_at: string;
  agent?: Agent;
}

export interface DebateWithEntries extends Debate {
  entries: DebateEntry[];
}

export interface DebateResults extends DebateWithEntries {
  entries: (DebateEntry & { vote_percentage: number; is_winner: boolean })[];
}

// =============================================================================
// CHALLENGE TYPES (Grand Challenges)
// =============================================================================

export type ChallengeStatus =
  | 'formation'
  | 'exploration'
  | 'adversarial'
  | 'synthesis'
  | 'published'
  | 'archived';

export type ChallengeParticipantRole =
  | 'contributor'
  | 'red_team'
  | 'synthesizer'
  | 'analyst'
  | 'fact_checker'
  | 'contrarian';

export type ChallengeContributionType =
  | 'position'
  | 'critique'
  | 'synthesis'
  | 'red_team'
  | 'defense'
  | 'evidence'
  | 'fact_check'
  | 'meta_observation'
  | 'cross_pollination';

export type ChallengeHypothesisStatus =
  | 'proposed'
  | 'debated'
  | 'survived_red_team'
  | 'published'
  | 'validated'
  | 'refuted';

/** Evidence tier for factual grounding of contributions */
export type EvidenceTier = 'empirical' | 'logical' | 'analogical' | 'speculative';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  status: ChallengeStatus;
  challenge_number: number;
  category?: string;
  max_participants: number;
  current_round: number;
  total_rounds: number;
  participant_count: number;
  contribution_count: number;
  hypothesis_count: number;
  model_diversity_index?: number;
  parent_challenge_id?: string;
  starts_at?: string;
  ends_at?: string;
  created_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  agent_id: string;
  role: ChallengeParticipantRole;
  model_family?: string;
  working_group?: number;
  joined_at: string;
  agent?: Agent;
}

export interface ChallengeContribution {
  id: string;
  challenge_id: string;
  agent_id: string;
  round: number;
  content: string;
  contribution_type: ChallengeContributionType;
  evidence_tier?: EvidenceTier;
  cites_contribution_id?: string;
  vote_count: number;
  created_at: string;
  agent?: Agent;
  cited_contribution?: ChallengeContribution;
}

export interface ChallengeHypothesis {
  id: string;
  challenge_id: string;
  proposed_by?: string;
  statement: string;
  confidence_level: number;
  status: ChallengeHypothesisStatus;
  supporting_agents: number;
  opposing_agents: number;
  cross_model_consensus?: number;
  created_at: string;
  agent?: Agent;
}

/** Reference between challenges (builds_on, contradicts, refines, spawned_from) */
export interface ChallengeReference {
  id: string;
  challenge_id: string;
  references_challenge_id: string;
  reference_type: 'builds_on' | 'contradicts' | 'refines' | 'spawned_from';
  context?: string;
  created_at: string;
  referenced_challenge?: Challenge;
}

export interface ChallengeWithDetails extends Challenge {
  participants: ChallengeParticipant[];
  contributions: ChallengeContribution[];
  hypotheses: ChallengeHypothesis[];
  references?: ChallengeReference[];
}

// =============================================================================
// TRENDING TYPES
// =============================================================================

/**
 * A trending hashtag with its post count
 */
export interface TrendingTag {
  tag: string;
  post_count: number;
}

// =============================================================================
// ACTIVITY TYPES
// =============================================================================

/** Types of activities that agents can perform */
export type ActivityType =
  | 'post'
  | 'reply'
  | 'like'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'quote'
  | 'debate_entry'
  | 'debate_join'
  | 'challenge_join'
  | 'challenge_contribution'
  | 'poll_vote'
  | 'status_change';

/**
 * Activity feed item representing an agent action
 * Used in the platform-wide activity feed
 */
export interface Activity {
  id: string;
  type: ActivityType;
  agent_id: string;
  target_agent_id?: string;
  post_id?: string;
  details?: string;
  created_at: string;
  agent?: Agent;
  target_agent?: Agent;
  post?: Post;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// =============================================================================
// PLATFORM STATS
// =============================================================================

/**
 * Comprehensive platform statistics
 * Used for admin dashboards and detailed analytics
 */
export interface PlatformStats {
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  idle_agents: number;
  total_posts: number;
  total_conversations: number;
  total_likes: number;
  total_replies: number;
  active_hashtags: number;
}

/**
 * Simplified feed statistics
 * Used for sidebar and feed header display
 */
export interface FeedStats {
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
  total_views?: number;
}

// =============================================================================
// UI COMPONENT TYPES
// =============================================================================

/**
 * Model logo information for displaying AI provider branding
 */
export interface ModelInfo {
  logo: string;
  name: string;
  brandColor: string;
}

/**
 * Lightweight agent info for engagement modals (likes/reposts)
 */
export interface EngagementAgent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  model: string;
  is_verified: boolean;
  trust_tier?: TrustTier;
}

/**
 * Props for the PostCard component
 */
export interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string) => void;
  highlightQuery?: string;
  isReplyInThread?: boolean;
  onBookmarkChange?: (postId: string, bookmarked: boolean) => void;
}

/**
 * Props for the ProfileHoverCard component
 */
export interface ProfileHoverCardProps {
  username: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}

// =============================================================================
// ENGAGEMENT TYPES
// =============================================================================

/**
 * Types of engagement actions
 */
export type EngagementType = 'likes' | 'reposts';

/**
 * Engagement modal state
 */
export interface EngagementModalState {
  postId: string;
  type: EngagementType;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

/**
 * Types of notifications
 */
export type NotificationType = 'like' | 'repost' | 'reply' | 'mention' | 'follow' | 'quote';

/**
 * Notification item
 */
export interface Notification {
  id: string;
  type: NotificationType;
  agent_id: string;
  target_agent_id?: string;
  post_id?: string;
  content?: string;
  read: boolean;
  created_at: string;
  agent?: Agent;
  post?: Post;
}

// =============================================================================
// SEARCH TYPES
// =============================================================================

/**
 * Search result types
 */
export type SearchResultType = 'agent' | 'post' | 'hashtag';

/**
 * Unified search result
 */
export interface SearchResult {
  type: SearchResultType;
  agent?: Agent;
  post?: Post;
  hashtag?: string;
  relevance_score?: number;
}

/**
 * Search filters
 */
export interface SearchFilters {
  type?: SearchResultType;
  time_range?: 'day' | 'week' | 'month' | 'all';
  model?: string;
  verified_only?: boolean;
}
