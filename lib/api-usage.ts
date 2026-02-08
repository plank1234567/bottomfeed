/**
 * API Usage Tracking & Metered Rate Limiting
 *
 * Provides tiered rate limiting for the Consensus Query API:
 * - free: 100 requests/day
 * - pro: 10,000 requests/day
 * - enterprise: 100,000 requests/day
 *
 * Uses the existing checkRateLimit() from lib/rate-limit.ts for
 * distributed Redis-backed limiting, with in-memory fallback.
 */

import { checkRateLimit } from './rate-limit';
import { supabase } from './supabase';
import { logger } from './logger';
import { MS_PER_DAY } from './constants';

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

export type ApiTier = 'free' | 'pro' | 'enterprise';

export const API_TIERS: Record<ApiTier, { maxRequestsPerDay: number; label: string }> = {
  free: { maxRequestsPerDay: 100, label: 'Free' },
  pro: { maxRequestsPerDay: 10_000, label: 'Pro' },
  enterprise: { maxRequestsPerDay: 100_000, label: 'Enterprise' },
};

// =============================================================================
// RATE LIMIT CHECK
// =============================================================================

export interface ApiUsageResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  tier: ApiTier;
  limit: number;
}

/**
 * Check whether the agent has remaining API quota for the day.
 * Wraps the existing unified checkRateLimit with tier-aware limits.
 */
export async function checkApiUsage(agentId: string, tier: ApiTier): Promise<ApiUsageResult> {
  const tierConfig = API_TIERS[tier];
  const limit = tierConfig.maxRequestsPerDay;

  const result = await checkRateLimit(agentId, limit, MS_PER_DAY, 'api-usage');

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
    tier,
    limit,
  };
}

// =============================================================================
// USAGE RECORDING
// =============================================================================

export interface ApiUsageRecord {
  agentId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  requestParams?: Record<string, unknown>;
}

/**
 * Record an API usage event. Fire-and-forget — errors are logged but never thrown.
 */
export function recordApiUsage(record: ApiUsageRecord): void {
  // Fire-and-forget insert
  supabase
    .from('api_usage')
    .insert({
      agent_id: record.agentId,
      endpoint: record.endpoint,
      method: record.method,
      status_code: record.statusCode,
      response_time_ms: record.responseTimeMs ?? null,
      request_params: record.requestParams ?? null,
    })
    .then(({ error }) => {
      if (error) {
        logger.warn('Failed to record API usage', {
          error: error.message,
          agentId: record.agentId,
        });
      }
    });
}

// =============================================================================
// RATE LIMIT HEADERS
// =============================================================================

/**
 * Generate standard rate limit response headers.
 */
export function rateLimitHeaders(usage: ApiUsageResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(usage.limit),
    'X-RateLimit-Remaining': String(Math.max(0, usage.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(usage.resetAt / 1000)),
  };
}
