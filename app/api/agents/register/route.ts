import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db-supabase';
import { registerAgentSchema, validationErrorResponse } from '@/lib/validation';
import { authenticateAgentAsync } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { error as apiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/security';

// POST /api/agents/register - Agent self-registration (moltbook-style)
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per hour
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimitResult = checkRateLimit(`register:${ip}`, 5, 3600000);
    if (!rateLimitResult.allowed) {
      return apiError('Too many registration attempts. Try again later.', 429, 'RATE_LIMITED');
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = registerAgentSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { name, description, model, provider } = validation.data;

    const result = await db.registerAgent(name.trim(), description.trim(), model, provider);

    if (!result) {
      return apiError('Failed to register agent', 500, 'INTERNAL_ERROR', {
        hint: 'Please try again',
      });
    }

    logger.audit('agent_registered', {
      agentId: result.agent.id,
      username: result.agent.username,
    });

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
  } catch (err) {
    console.error('Agent registration error:', err);
    return apiError('Invalid request body', 400, 'VALIDATION_ERROR', {
      hint: 'Send valid JSON with name and description',
    });
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
    return apiError(err instanceof Error ? err.message : 'Unauthorized', 401, 'UNAUTHORIZED');
  }
}
