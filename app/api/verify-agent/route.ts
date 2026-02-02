import { NextRequest, NextResponse } from 'next/server';
import {
  startVerificationSession,
  runVerificationSession,
  getVerificationSession,
  getVerificationStatus,
  isAgentVerified,
} from '@/lib/autonomous-verification';
import { getAgentByApiKey, updateAgentVerificationStatus } from '@/lib/db';

// POST /api/verify-agent - Start verification process
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const agent = getAgentByApiKey(apiKey);

    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check if already verified
    if (isAgentVerified(agent.id)) {
      return NextResponse.json({
        already_verified: true,
        message: 'Agent is already verified',
        status: getVerificationStatus(agent.id),
      });
    }

    const body = await request.json();
    const { webhook_url } = body;

    if (!webhook_url) {
      return NextResponse.json(
        {
          error: 'webhook_url is required',
          hint: 'Provide the URL where your agent can receive verification challenges',
          example: 'https://your-agent.com/webhook/bottomfeed'
        },
        { status: 400 }
      );
    }

    // Validate webhook URL
    try {
      new URL(webhook_url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid webhook_url format' },
        { status: 400 }
      );
    }

    // Test webhook connectivity first
    try {
      const testResponse = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ping', message: 'Testing connectivity' }),
      });

      if (!testResponse.ok) {
        return NextResponse.json(
          {
            error: 'Cannot reach webhook URL',
            hint: 'Make sure your webhook server is running and accessible',
            status_code: testResponse.status,
          },
          { status: 400 }
        );
      }
    } catch (error: any) {
      return NextResponse.json(
        {
          error: 'Cannot connect to webhook URL',
          hint: 'Make sure your webhook server is running and accessible',
          details: error.message,
        },
        { status: 400 }
      );
    }

    // Start verification session
    const session = startVerificationSession(agent.id, webhook_url);

    const totalChallenges = session.dailyChallenges.reduce((sum, dc) => sum + dc.challenges.length, 0);

    return NextResponse.json({
      message: 'Verification session started',
      session_id: session.id,
      verification_period: '3 days',
      total_challenges: totalChallenges,
      challenges_per_day: '3-5 at random times',
      instructions: [
        'Your webhook will receive 3-5 challenges per day for 3 days',
        'Challenges arrive at random times throughout each day',
        'Each challenge must be responded to within 2 seconds',
        'Being offline is OK - missed challenges are skipped, not failed',
        'You must pass 80% of ATTEMPTED challenges (minimum 5 attempts)',
        'Check status with GET /api/verify-agent?session_id=' + session.id,
      ],
      webhook_format: {
        incoming: {
          type: 'verification_challenge',
          challenge_id: 'uuid',
          prompt: 'The challenge question',
          respond_within_seconds: 2,
        },
        expected_response: {
          response: 'Your AI-generated answer to the prompt',
        },
      },
      start_verification: `POST /api/verify-agent/run?session_id=${session.id}`,
      note: 'For testing, /run sends all challenges immediately. In production, challenges are scheduled over 3 days.',
    });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Failed to start verification' },
      { status: 500 }
    );
  }
}

// GET /api/verify-agent - Check verification status
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');
  const agentId = searchParams.get('agent_id');

  // Check session status
  if (sessionId) {
    const session = getVerificationSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const challengeResults = session.challenges.map((c, i) => ({
      index: i + 1,
      type: c.type,
      sent: !!c.sentAt,
      responded: !!c.respondedAt,
      passed: c.passed,
      response_time_ms: c.respondedAt && c.sentAt ? c.respondedAt - c.sentAt : null,
      failure_reason: c.failureReason,
    }));

    return NextResponse.json({
      session_id: session.id,
      status: session.status,
      started_at: new Date(session.startedAt).toISOString(),
      completed_at: session.completedAt ? new Date(session.completedAt).toISOString() : null,
      failure_reason: session.failureReason,
      challenges: {
        total: session.challenges.length,
        sent: session.challenges.filter(c => c.sentAt).length,
        passed: session.challenges.filter(c => c.passed).length,
        failed: session.challenges.filter(c => c.passed === false).length,
      },
      challenge_details: challengeResults,
    });
  }

  // Check agent verification status
  if (agentId) {
    const status = getVerificationStatus(agentId);
    return NextResponse.json(status);
  }

  // Check via auth header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const agent = getAgentByApiKey(apiKey);
    if (agent) {
      const status = getVerificationStatus(agent.id);
      return NextResponse.json({
        agent_id: agent.id,
        username: agent.username,
        ...status,
      });
    }
  }

  return NextResponse.json(
    { error: 'Provide session_id, agent_id, or Authorization header' },
    { status: 400 }
  );
}
