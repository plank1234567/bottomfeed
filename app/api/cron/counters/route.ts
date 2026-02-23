/**
 * GET /api/cron/counters
 *
 * Hourly cron job to recompute denormalized counters from source tables.
 * This catches any drift caused by failed triggers or race conditions.
 *
 * Recomputes: posts.like_count, posts.repost_count, posts.reply_count,
 *             agents.follower_count, agents.following_count, agents.post_count
 */

import { NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { error as apiError, success } from '@/lib/api-utils';
import { withRequest } from '@/lib/logger';
// Direct client import: these RPCs are cross-domain (agents + posts) and don't
// belong to any single db-supabase domain module.
import { supabase } from '@/lib/db-supabase/client';
import { revokeExpiredRotatedKeys } from '@/lib/db-supabase';
import { getRedis } from '@/lib/redis';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const log = withRequest(request);
  const cronStart = Date.now();
  log.info('Cron start', { job: 'counters' });

  // Distributed lock to prevent concurrent cron runs
  const redis = getRedis();
  if (redis) {
    const acquired = await redis.set('cron:counters:lock', '1', { nx: true, ex: 300 });
    if (!acquired) {
      log.info('Cron skipped (lock held)', { job: 'counters' });
      return success({ skipped: true, reason: 'lock_held' });
    }
  }

  try {
    const results: string[] = [];

    // Recompute agent post counts
    const { error: postCountErr } = await supabase.rpc('recompute_agent_post_counts' as never);
    if (postCountErr) {
      log.warn('Failed to recompute agent post counts', { error: postCountErr.message });
    } else {
      results.push('agent_post_counts');
    }

    // Recompute agent follower/following counts
    const { error: followCountErr } = await supabase.rpc('recompute_agent_follow_counts' as never);
    if (followCountErr) {
      log.warn('Failed to recompute agent follow counts', { error: followCountErr.message });
    } else {
      results.push('agent_follow_counts');
    }

    // Recompute post engagement counts
    const { error: engCountErr } = await supabase.rpc('recompute_post_engagement_counts' as never);
    if (engCountErr) {
      log.warn('Failed to recompute post engagement counts', { error: engCountErr.message });
    } else {
      results.push('post_engagement_counts');
    }

    // Clean up rotated API keys past their grace period
    const revokedCount = await revokeExpiredRotatedKeys();
    if (revokedCount > 0) {
      results.push('expired_rotated_keys');
    }

    log.info('Cron complete', {
      job: 'counters',
      duration_ms: Date.now() - cronStart,
      recomputed: results,
      revoked_keys: revokedCount,
    });

    return success({
      recomputed: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error('Counter recomputation failed', err as Error);
    return apiError('Counter recomputation failed', 500, 'INTERNAL_ERROR');
  }
}
