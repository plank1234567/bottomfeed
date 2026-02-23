import { NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { error as apiError, success } from '@/lib/api-utils';
import {
  getOpenDebatesToClose,
  closeDebate,
  getActiveDebate,
  createDebate,
  getNextDebateNumber,
} from '@/lib/db-supabase';
import { invalidateCache } from '@/lib/cache';
import { DEBATE_TOPICS } from '@/lib/debate-topics';
import { DEBATE_DURATION_HOURS } from '@/lib/constants';
import { withRequest } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

export const maxDuration = 300;

/**
 * GET /api/cron/debates
 *
 * Called hourly by external cron to manage debate lifecycle:
 * 1. Close open debates past their closes_at time
 * 2. Create new debate if no active one exists
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const log = withRequest(request);
  const cronStart = Date.now();
  log.info('Cron start', { job: 'debates' });

  // Distributed lock to prevent concurrent cron runs
  const redis = getRedis();
  if (redis) {
    const acquired = await redis.set('cron:debates:lock', '1', { nx: true, ex: 300 });
    if (!acquired) {
      log.info('Cron skipped (lock held)', { job: 'debates' });
      return success({ skipped: true, reason: 'lock_held' });
    }
  }

  try {
    let debatesClosed = 0;
    let newDebateOpened = false;

    // Step 1: Close expired debates
    const expiredDebates = await getOpenDebatesToClose();
    for (const debate of expiredDebates) {
      const closed = await closeDebate(debate.id);
      if (closed) {
        debatesClosed++;
        log.info('Debate closed', {
          debateId: debate.id,
          debateNumber: debate.debate_number,
          topic: debate.topic,
        });
      }
    }

    // Step 2: Check if active debate exists
    const activeDebate = await getActiveDebate();

    if (!activeDebate) {
      // Step 3: Create new debate
      const nextNumber = await getNextDebateNumber();
      const topicIndex = (nextNumber - 1) % DEBATE_TOPICS.length;
      const topic = DEBATE_TOPICS[topicIndex]!;

      const now = new Date();
      const closesAt = new Date(now.getTime() + DEBATE_DURATION_HOURS * 60 * 60 * 1000);

      const newDebate = await createDebate(
        topic.topic,
        topic.description,
        nextNumber,
        now.toISOString(),
        closesAt.toISOString()
      );

      if (newDebate) {
        newDebateOpened = true;
        log.info('New debate created', {
          debateId: newDebate.id,
          debateNumber: nextNumber,
          topic: topic.topic,
        });
      }

      // Invalidate active debate cache
      await invalidateCache('debate:active');
    }

    log.info('Cron complete', {
      job: 'debates',
      duration_ms: Date.now() - cronStart,
      debates_closed: debatesClosed,
      new_debate_opened: newDebateOpened,
    });

    return success({
      debates_closed: debatesClosed,
      new_debate_opened: newDebateOpened,
    });
  } catch (err) {
    log.error('[Cron/Debates] Error', err);
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500, 'INTERNAL_ERROR');
  }
}
