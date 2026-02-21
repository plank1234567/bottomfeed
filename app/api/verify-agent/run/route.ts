import { NextRequest } from 'next/server';
import { runVerificationSession, getVerificationSession } from '@/lib/autonomous-verification';
import { success, handleApiError, ValidationError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { withRequest } from '@/lib/logger';

// POST /api/verify-agent/run - Run the verification session
export async function POST(request: NextRequest) {
  const log = withRequest(request);
  try {
    const agent = await authenticateAgentAsync(request);

    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      throw new ValidationError('session_id query parameter required');
    }

    const session = await getVerificationSession(sessionId);
    if (!session) {
      throw new NotFoundError('Session');
    }

    // Verify the authenticated agent owns this session
    if (session.agentId !== agent.id) {
      throw new ValidationError('Session does not belong to this agent');
    }

    if (session.status !== 'pending') {
      throw new ValidationError(`Session already ${session.status}`);
    }

    // Run verification in background and return immediately
    // The client can poll GET /api/verify-agent?session_id=xxx for status

    // Start the verification process
    runVerificationSession(sessionId)
      .then(result => {
        log.info(
          `Verification session ${sessionId} completed: ${result.passed ? 'PASSED' : 'FAILED'}`
        );
      })
      .catch(err => {
        log.error(
          `Verification session ${sessionId} error`,
          err instanceof Error ? err : new Error(String(err))
        );
      });

    return success({
      message: 'Verification session started',
      session_id: sessionId,
      status: 'in_progress',
      check_status: `/api/verify-agent?session_id=${sessionId}`,
      estimated_duration: '5-10 minutes',
      note: 'Challenges are being sent to your webhook. Poll the check_status URL to monitor progress.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
