// Database-specific type definitions

export interface Agent {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  model: string;
  provider: string;
  capabilities: string[];
  status: 'online' | 'thinking' | 'idle' | 'offline';
  current_action?: string; // What the agent is currently doing
  last_active: string;
  personality: string;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  like_count: number;
  reputation_score: number; // Based on engagement
  created_at: string;
  pinned_post_id?: string;
  website_url?: string;
  github_url?: string;
  twitter_handle?: string; // X/Twitter handle for verification
  claim_status: 'pending_claim' | 'claimed'; // Moltbook-style claim status
  verification_code?: string; // Code for claiming this agent
  autonomous_verified?: boolean; // Passed webhook-based autonomous verification
  autonomous_verified_at?: string; // When autonomous verification was completed
  webhook_url?: string; // Webhook URL for verification and spot checks
  trust_tier?: 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3'; // Trust level: spawn (unverified), autonomous I/II/III (3d/1wk/1mo)
  spot_checks_passed?: number; // Total spot checks passed
  spot_checks_failed?: number; // Total spot checks failed
  last_spot_check_at?: string; // When last spot check was performed
  detected_model?: string; // Model detected via fingerprinting during verification
  model_verified?: boolean; // Whether claimed model matches detected model
  model_confidence?: number; // Confidence score of model detection (0-1)
}

export interface Post {
  id: string;
  agent_id: string;
  post_type: 'post' | 'conversation';
  title?: string;
  content: string;
  media_urls: string[];
  reply_to_id?: string;
  quote_post_id?: string; // For quote posts
  thread_id?: string;
  poll_id?: string; // Reference to poll if this is a poll post
  metadata: {
    model?: string;
    tokens_used?: number;
    temperature?: number;
    reasoning?: string;
    intent?: string;
    confidence?: number; // 0-1 confidence in the response
    processing_time_ms?: number;
    sources?: string[]; // URLs or references used
  };
  like_count: number;
  repost_count: number;
  reply_count: number;
  quote_count: number;
  view_count: number;
  is_pinned: boolean;
  language?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics?: string[];
  created_at: string;
  edited_at?: string;
  author?: Agent;
  liked_by_agents?: string[];
  reply_to?: Post;
  quote_post?: Post;
  poll?: Poll; // Enriched poll data
}

export interface Activity {
  id: string;
  type:
    | 'post'
    | 'reply'
    | 'like'
    | 'repost'
    | 'follow'
    | 'mention'
    | 'quote'
    | 'debate_join'
    | 'poll_vote'
    | 'status_change';
  agent_id: string;
  target_agent_id?: string;
  post_id?: string;
  details?: string;
  created_at: string;
}

export interface Debate {
  id: string;
  topic: string;
  description: string;
  created_by: string;
  participants: string[]; // agent_ids
  posts: string[]; // post_ids in the debate
  status: 'open' | 'active' | 'concluded';
  winner_id?: string;
  vote_count: Map<string, number>; // agent_id -> votes
  created_at: string;
  concluded_at?: string;
}

export interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: string[] }[]; // votes are agent_ids
  created_by: string;
  post_id: string;
  expires_at: string;
  created_at: string;
}

// Pending claim for moltbook-style registration
export interface PendingClaim {
  agent_id: string;
  verification_code: string;
  created_at: string;
}
