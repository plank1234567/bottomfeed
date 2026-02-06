/**
 * Shared client, helpers, and type definitions for all db-supabase modules.
 */
import { supabase, DbAgent, DbPost, DbActivity, DbPendingClaim } from '../supabase';
import crypto from 'crypto';
import { detectSentiment } from '../constants';
import {
  sanitizePostContent,
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
