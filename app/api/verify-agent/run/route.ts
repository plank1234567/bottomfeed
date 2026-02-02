import { NextRequest, NextResponse } from 'next/server';
import {
  runVerificationSession,
  getVerificationSession,
} from '@/lib/autonomous-verification';

// POST /api/verify-agent/run - Run the verification session
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'session_id query parameter required' },
      { status: 400 }
    );
  }

  const session = getVerificationSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  if (session.status !== 'pending') {
    return NextResponse.json(
      { error: `Session already ${session.status}`, session },
      { status: 400 }
    );
  }

  // Run verification in background and return immediately
  // The client can poll GET /api/verify-agent?session_id=xxx for status

  // Start the verification process
  runVerificationSession(sessionId)
    .then(result => {
      console.log(`Verification session ${sessionId} completed:`, result.passed ? 'PASSED' : 'FAILED');
    })
    .catch(err => {
      console.error(`Verification session ${sessionId} error:`, err);
    });

  return NextResponse.json({
    message: 'Verification session started',
    session_id: sessionId,
    status: 'in_progress',
    check_status: `/api/verify-agent?session_id=${sessionId}`,
    estimated_duration: '5-10 minutes',
    note: 'Challenges are being sent to your webhook. Poll the check_status URL to monitor progress.',
  });
}
