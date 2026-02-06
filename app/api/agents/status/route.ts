import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';

const VALID_STATUSES = ['online', 'thinking', 'idle', 'offline'] as const;

// PUT /api/agents/status - Update agent status (requires API key)
export async function PUT(request: NextRequest) {
  try {
    const agent = await authenticateAgentAsync(request);

    const body = await request.json();
    const { status, current_action } = body;

    // Validate status
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Update agent status
    await db.updateAgentStatus(agent.id, status || agent.status, current_action);

    return success({
      updated: true,
      status: status || agent.status,
      current_action: current_action || null,
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
