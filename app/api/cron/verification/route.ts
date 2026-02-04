import { NextRequest, NextResponse } from 'next/server';
import {
  schedulerTick,
  isSchedulerRunning,
  startScheduler,
  stopScheduler,
} from '@/lib/verification-scheduler';
import { rescheduleNextBurstForTesting } from '@/lib/autonomous-verification';

// Secret key to protect cron endpoint (set in environment)
// In production, CRON_SECRET must be set - no fallback for security
const CRON_SECRET = process.env.CRON_SECRET;

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
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  const providedSecret = authHeader?.replace('Bearer ', '');

  // In development, allow without secret for testing
  const isDev = process.env.NODE_ENV === 'development';

  // In production, CRON_SECRET must be set
  if (!isDev && !CRON_SECRET) {
    console.error('[Cron] CRON_SECRET environment variable is not set');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (!isDev && providedSecret !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await schedulerTick();

    return NextResponse.json({
      success: true,
      ...result,
      summary: {
        challenges_sent: result.challenges.challengesSent,
        sessions_processed: result.challenges.sessionsProcessed,
        spot_checks_processed: result.spotChecks.checksProcessed,
        spot_checks_passed: result.spotChecks.passed,
        spot_checks_failed: result.spotChecks.failed,
      },
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: 'Only available in development' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, interval_ms } = body;

    switch (action) {
      case 'start':
        startScheduler(interval_ms || 60000);
        return NextResponse.json({
          success: true,
          message: 'Scheduler started',
          interval_ms: interval_ms || 60000,
        });

      case 'stop':
        stopScheduler();
        return NextResponse.json({
          success: true,
          message: 'Scheduler stopped',
        });

      case 'status':
        return NextResponse.json({
          success: true,
          running: isSchedulerRunning(),
        });

      case 'tick':
        // Manual trigger
        const result = await schedulerTick();
        return NextResponse.json({
          success: true,
          ...result,
        });

      case 'test':
        // FOR TESTING: Reschedule next burst to now and process it
        const { session_id } = body;
        if (!session_id) {
          return NextResponse.json(
            { error: 'session_id required for test action' },
            { status: 400 }
          );
        }

        // Reschedule the next burst to happen now
        const rescheduleResult = rescheduleNextBurstForTesting(session_id);
        if (!rescheduleResult || !rescheduleResult.success) {
          return NextResponse.json({
            success: false,
            error: 'No pending challenges to reschedule',
          });
        }

        // Wait a moment for the reschedule to take effect
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Now trigger the scheduler to process
        const tickResult = await schedulerTick();

        return NextResponse.json({
          success: true,
          rescheduled: rescheduleResult,
          processed: tickResult,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, status, tick, or test' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
