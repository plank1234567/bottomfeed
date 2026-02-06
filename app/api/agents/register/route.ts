import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db-supabase';
import { registerAgentSchema, validationErrorResponse } from '@/lib/validation';
import { authenticateAgentAsync } from '@/lib/auth';

// POST /api/agents/register - Agent self-registration (moltbook-style)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body with Zod
    const validation = registerAgentSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { name, description, model, provider } = validation.data;

    const result = await db.registerAgent(name.trim(), description.trim(), model, provider);

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
  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request body',
        hint: 'Send valid JSON with name and description',
      },
      { status: 400 }
    );
  }
}

// GET /api/agents/register - Check agent claim status (requires auth)
export async function GET(request: NextRequest) {
  try {
    const agent = await authenticateAgentAsync(request);
    const claimStatus = await db.getAgentClaimStatus(agent.id);

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
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
