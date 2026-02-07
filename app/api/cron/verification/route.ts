import { NextRequest } from 'next/server';
import {
  schedulerTick,
  isSchedulerRunning,
  startScheduler,
  stopScheduler,
} from '@/lib/verification-scheduler';
import { rescheduleNextBurstForTesting } from '@/lib/autonomous-verification';
import { verifyCronSecret } from '@/lib/auth';
import { error as apiError, success } from '@/lib/api-utils';
import { cronVerificationActionSchema, validationErrorResponse } from '@/lib/validation';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/verification
 *
 * Called by external cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * Processes all scheduled challenges and spot checks.
 *
 * In production, set up cron to call this every minute:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/verification
 *
 * For Vercel, add to vercel.json:
 *   "crons": [{ "path": "/api/cron/verification", "schedule": "* * * * *" }]
 */
export async function GET(request: NextRequest) {
  // Use timing-safe cron secret verification
  if (!verifyCronSecret(request)) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const result = await schedulerTick();

    return success({
      ...result,
      summary: {
        challenges_sent: result.challenges.challengesSent,
        sessions_processed: result.challenges.sessionsProcessed,
        spot_checks_processed: result.spotChecks.checksProcessed,
        spot_checks_passed: result.spotChecks.passed,
        spot_checks_failed: result.spotChecks.failed,
      },
    });
  } catch (err) {
    logger.error('[Cron] Error', err);
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * POST /api/cron/verification
 *
 * Control the internal scheduler (for development)
 *
 * Body: { action: "start" | "stop" | "status" }
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return apiError('Only available in development', 403, 'FORBIDDEN');
  }

  try {
    const body = await request.json();
    const validation = cronVerificationActionSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { action, interval_ms, session_id } = validation.data;

    switch (action) {
      case 'start':
        startScheduler(interval_ms || 60000);
        return success({
          message: 'Scheduler started',
          interval_ms: interval_ms || 60000,
        });

      case 'stop':
        stopScheduler();
        return success({
          message: 'Scheduler stopped',
        });

      case 'status':
        return success({
          running: isSchedulerRunning(),
        });

      case 'tick': {
        // Manual trigger
        const result = await schedulerTick();
        return success(result);
      }

      case 'test': {
        // FOR TESTING: Reschedule next burst to now and process it
        // session_id is guaranteed by the schema refinement
        const rescheduleResult = rescheduleNextBurstForTesting(session_id!);
        if (!rescheduleResult || !rescheduleResult.success) {
          return apiError('No pending challenges to reschedule', 500, 'INTERNAL_ERROR');
        }

        // Wait a moment for the reschedule to take effect
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Now trigger the scheduler to process
        const tickResult = await schedulerTick();

        return success({
          rescheduled: rescheduleResult,
          processed: tickResult,
        });
      }
    }
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500, 'INTERNAL_ERROR');
  }
}
