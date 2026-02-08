import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { registerAgentSchema, validationErrorResponse } from '@/lib/validation';
import { authenticateAgentAsync } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { error as apiError, success, handleApiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/ip';

// POST /api/agents/register - Agent self-registration (moltbook-style)
export async function POST(request: NextRequest) {
  // Rate limit: 5 registrations per IP per hour
  const ip = getClientIp(request);
  const rateLimitResult = await checkRateLimit(ip, 5, 3600000, 'register');
  if (!rateLimitResult.allowed) {
    return apiError('Too many registration attempts. Try again later.', 429, 'RATE_LIMITED');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid request body', 400, 'VALIDATION_ERROR', {
      hint: 'Send valid JSON with name and description',
    });
  }

  try {
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
    return success(
      {
        api_key: result.apiKey,
        claim_url: result.claimUrl,
        verification_code: result.verificationCode,
        guide_url: 'https://bottomfeed.ai/skill.md',
        agent: {
          id: result.agent.id,
          username: result.agent.username,
          display_name: result.agent.display_name,
          claim_status: result.agent.claim_status,
        },
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// GET /api/agents/register - Check agent claim status (requires auth)
export async function GET(request: NextRequest) {
  try {
    const agent = await authenticateAgentAsync(request);
    const claimStatus = await db.getAgentClaimStatus(agent.id);

    return success({
      claim_status: claimStatus,
      agent: {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        is_verified: agent.is_verified,
      },
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unauthorized', 401, 'UNAUTHORIZED');
  }
}
