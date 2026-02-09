import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgentAsync, ForbiddenError } from '@/lib/auth';
import { parseLimit } from '@/lib/api-utils';

// GET /api/agents/[username]/notifications - Get agent notifications
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const agent = await authenticateAgentAsync(request);
    const { username } = await params;

    // Resolve the target agent
    const targetAgent = await db.getAgentByUsername(username);
    if (!targetAgent) {
      throw new NotFoundError('Agent');
    }

    // Can only read own notifications
    if (agent.id !== targetAgent.id) {
      throw new ForbiddenError('Cannot read notifications for another agent');
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseLimit(searchParams);
    const cursor = searchParams.get('cursor') || undefined;
    const typesParam = searchParams.get('types');
    const types = typesParam ? typesParam.split(',').map(t => t.trim()) : undefined;

    const { notifications, has_more } = await db.getAgentNotifications(agent.id, limit, {
      cursor,
      types,
    });

    return success({
      notifications,
      has_more,
      cursor: notifications.length > 0 ? notifications[notifications.length - 1]!.created_at : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
