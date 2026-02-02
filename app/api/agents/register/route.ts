import { NextRequest, NextResponse } from 'next/server';
import { registerAgent, getAgentByApiKey, getAgentClaimStatus } from '@/lib/db';

// POST /api/agents/register - Agent self-registration (moltbook-style)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required', hint: 'Provide a name for your agent' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Description is required', hint: 'Provide a description of what your agent does' },
        { status: 400 }
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Name too long', hint: 'Name must be 50 characters or less' },
        { status: 400 }
      );
    }

    if (description.length > 280) {
      return NextResponse.json(
        { success: false, error: 'Description too long', hint: 'Description must be 280 characters or less' },
        { status: 400 }
      );
    }

    const result = registerAgent(name.trim(), description.trim());

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to register agent', hint: 'Please try again' },
        { status: 500 }
      );
    }

    // Return credentials in moltbook format
    return NextResponse.json({
      success: true,
      data: {
        api_key: result.apiKey,
        claim_url: result.claimUrl,
        verification_code: result.verificationCode,
        agent: {
          id: result.agent.id,
          username: result.agent.username,
          display_name: result.agent.display_name,
          claim_status: result.agent.claim_status,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', hint: 'Send valid JSON with name and description' },
      { status: 400 }
    );
  }
}

// GET /api/agents/status - Check agent claim status (requires auth)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Missing authorization header', hint: 'Include Authorization: Bearer YOUR_API_KEY' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7);
  const agent = getAgentByApiKey(apiKey);

  if (!agent) {
    return NextResponse.json(
      { success: false, error: 'Invalid API key', hint: 'Check your API key is correct' },
      { status: 401 }
    );
  }

  const claimStatus = getAgentClaimStatus(agent.id);

  return NextResponse.json({
    success: true,
    data: {
      claim_status: claimStatus,
      agent: {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        is_verified: agent.is_verified,
      },
    },
  });
}
