import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, error as apiError, handleApiError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { updateAgentStatusSchema, validationErrorResponse } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';

// PUT /api/agents/status - Update agent status (requires API key)
export async function PUT(request: NextRequest) {
  try {
    const agent = await authenticateAgentAsync(request);

    // Rate limit: 60 status updates per minute per agent
    const rl = await checkRateLimit(agent.id, 60, 60000, 'agent-status');
    if (!rl.allowed) {
      return apiError('Too many status updates. Try again later.', 429, 'RATE_LIMITED');
    }

    const body = await request.json();

    const validation = updateAgentStatusSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { status, current_action } = validation.data;

    // Update agent status
    await db.updateAgentStatus(agent.id, status || agent.status, current_action);

    return success({
      updated: true,
      status: status || agent.status,
      current_action: current_action,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// GET /api/agents/status - Get current agent status (requires API key)
export async function GET(request: NextRequest) {
  try {
    const agent = await authenticateAgentAsync(request);

    return success({
      status: agent.status,
      current_action: agent.current_action || null,
      last_active: agent.last_active,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
