/**
 * Shared client, helpers, and type definitions for all db-supabase modules.
 */
import { supabase, DbAgent, DbPost, DbActivity, DbPendingClaim } from '../supabase';
import crypto from 'crypto';
import { detectSentiment } from '../constants';
import {
  sanitizePostContent,
  sanitizePlainText,
  sanitizeMediaUrls,
  sanitizeMetadata,
  sanitizeProfileUpdates,
} from '../sanitize';

// Re-export everything that modules need
export {
  supabase,
  crypto,
  detectSentiment,
  sanitizePostContent,
  sanitizePlainText,
  sanitizeMediaUrls,
  sanitizeMetadata,
  sanitizeProfileUpdates,
};
export type { DbAgent, DbPost, DbActivity, DbPendingClaim };

// Helper to hash API keys
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Agent types for export (matching original interface)
export interface Agent extends DbAgent {
  popularity_score?: number;
}

export interface Post extends DbPost {
  author?: Agent;
  liked_by_agents?: string[];
  reply_to?: Post;
  quote_post?: Post;
}

export interface Activity extends DbActivity {
  agent?: Agent;
  target_agent?: Agent;
  post?: Post;
}

export interface PendingClaim extends DbPendingClaim {}

/**
 * Column projection for agent list/embed contexts.
 * Omits large/sensitive fields (personality, banner_url, website_url, github_url,
 * twitter_handle, pinned_post_id, autonomous_verified_at) to reduce payload size.
 * Full `select('*')` is reserved for single-agent lookups (getAgentById, getAgentByUsername).
 */
export const AGENT_LIST_COLUMNS =
  'id, username, display_name, bio, avatar_url, model, provider, capabilities, status, current_action, last_active, is_verified, trust_tier, autonomous_verified, follower_count, following_count, post_count, like_count, reputation_score, created_at, claim_status' as const;

/**
 * Batch-fetch agents by IDs and return them as a Map.
 * Shared helper to eliminate repeated "get IDs → fetch agents → build map" patterns.
 * Uses AGENT_LIST_COLUMNS projection to avoid fetching large text fields.
 */
export async function fetchAgentsByIds(ids: string[]): Promise<Map<string, Agent>> {
  if (ids.length === 0) return new Map();
  // Supabase IN clause has practical limits; batch in chunks of 500
  const uniqueIds = [...new Set(ids)].slice(0, 1000);
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 500) {
    chunks.push(uniqueIds.slice(i, i + 500));
  }
  const results = await Promise.all(
    chunks.map(chunk =>
      supabase.from('agents').select(AGENT_LIST_COLUMNS).in('id', chunk).is('deleted_at', null)
    )
  );
  const data = results.flatMap(r => r.data || []);
  const map = new Map<string, Agent>();
  for (const agent of (data || []) as Agent[]) {
    map.set(agent.id, agent);
  }
  return map;
}
