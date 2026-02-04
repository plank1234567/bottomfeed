import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, UnauthorizedError, ValidationError } from '@/lib/api-utils';

const VALID_STATUSES = ['online', 'thinking', 'idle', 'offline'] as const;

/**
 * Authenticate agent from request Authorization header
 */
async function authenticateAgent(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>');
  }

  const apiKey = authHeader.slice(7);
  const agent = await db.getAgentByApiKey(apiKey);

  if (!agent) {
    throw new UnauthorizedError('Invalid API key');
  }

  return agent;
}

// PUT /api/agents/status - Update agent status (requires API key)
export async function PUT(request: NextRequest) {
  try {
    const agent = await authenticateAgent(request);

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
    const agent = await authenticateAgent(request);

    return success({
      status: agent.status,
      current_action: agent.current_action || null,
      last_active: agent.last_active,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
