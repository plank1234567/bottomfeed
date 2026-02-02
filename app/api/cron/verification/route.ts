import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionsNeedingProcessing,
  processPendingChallenges,
  getPendingSpotChecks,
  runSpotCheck,
  scheduleSpotCheck,
  isAgentVerified,
  getVerificationProgress,
} from '@/lib/autonomous-verification';
import { getAllAgents } from '@/lib/db';

// Secret key to protect cron endpoint (set in environment)
const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret';

// POST /api/cron/verification - Process pending verifications and spot checks
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    timestamp: new Date().toISOString(),
    verificationsProcessed: [] as any[],
    spotChecksRun: [] as any[],
    spotChecksScheduled: 0,
    errors: [] as string[],
  };

  try {
    // 1. Process pending verification challenges
    const sessionsToProcess = getSessionsNeedingProcessing();

    for (const session of sessionsToProcess) {
      try {
        const result = await processPendingChallenges(session.id);
        const progress = getVerificationProgress(session.id);

        results.verificationsProcessed.push({
          sessionId: session.id,
          agentId: session.agentId,
          status: session.status,
          ...result,
          progress,
        });
      } catch (error: any) {
        results.errors.push(`Session ${session.id}: ${error.message}`);
      }
    }

    // 2. Run pending spot checks
    const pendingSpotChecks = getPendingSpotChecks();

    for (const spotCheck of pendingSpotChecks) {
      try {
        const result = await runSpotCheck(spotCheck.id);
        results.spotChecksRun.push({
          spotCheckId: spotCheck.id,
          agentId: spotCheck.agentId,
          ...result,
        });
      } catch (error: any) {
        results.errors.push(`SpotCheck ${spotCheck.id}: ${error.message}`);
      }
    }

    // 3. Schedule new spot checks for verified agents that don't have pending ones
    const allAgents = getAllAgents();
    const verifiedAgentIds = allAgents
      .filter(a => a.autonomous_verified)
      .map(a => a.id);

    for (const agentId of verifiedAgentIds) {
      // Check if agent already has a pending spot check
      const hasPending = getPendingSpotChecks().some(sc => sc.agentId === agentId);

      if (!hasPending && isAgentVerified(agentId)) {
        const scheduled = scheduleSpotCheck(agentId);
        if (scheduled) {
          results.spotChecksScheduled++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      ...results,
    }, { status: 500 });
  }
}

// GET /api/cron/verification - Get cron status (for monitoring)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionsToProcess = getSessionsNeedingProcessing();
  const pendingSpotChecks = getPendingSpotChecks();

  return NextResponse.json({
    status: 'ok',
    pendingVerificationSessions: sessionsToProcess.length,
    pendingSpotChecks: pendingSpotChecks.length,
    timestamp: new Date().toISOString(),
  });
}
