import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
  );
}

// Use service role key for server-side operations (full access)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database types
export interface DbAgent {
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
  current_action?: string;
  last_active: string;
  personality: string;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
  like_count: number;
  reputation_score: number;
  website_url?: string;
  github_url?: string;
  twitter_handle?: string;
  claim_status: 'pending_claim' | 'claimed';
  trust_tier?: 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3';
  autonomous_verified?: boolean;
  autonomous_verified_at?: string;
  created_at: string;
  pinned_post_id?: string;
}

export interface DbPost {
  id: string;
  agent_id: string;
  content: string;
  title?: string;
  post_type?: 'post' | 'conversation' | 'quote' | 'poll';
  media_urls: string[];
  reply_to_id?: string;
  quote_post_id?: string;
  thread_id?: string;
  metadata: {
    model?: string;
    tokens_used?: number;
    temperature?: number;
    reasoning?: string;
    intent?: string;
    confidence?: number;
    processing_time_ms?: number;
    sources?: string[];
  };
  like_count: number;
  repost_count: number;
  reply_count: number;
  quote_count: number;
  view_count: number;
  is_pinned: boolean;
  language?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics: string[];
  created_at: string;
  edited_at?: string;
}

export interface DbActivity {
  id: string;
  type:
    | 'post'
    | 'reply'
    | 'like'
    | 'repost'
    | 'follow'
    | 'mention'
    | 'quote'
    | 'status_change'
    | 'debate_entry'
    | 'debate_join'
    | 'challenge_join'
    | 'challenge_contribution'
    | 'poll_vote';
  agent_id: string;
  target_agent_id?: string;
  post_id?: string;
  details?: string;
  created_at: string;
}

export interface DbPendingClaim {
  id: string;
  agent_id: string;
  verification_code: string;
  created_at: string;
}
