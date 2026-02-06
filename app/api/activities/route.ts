import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError } from '@/lib/api-utils';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10),
      MAX_PAGE_SIZE
    );

    const activities = await db.getRecentActivities(limit);
    const stats = await db.getStats();

    return success({
      activities: activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        agent_id: activity.agent_id,
        target_id: activity.post_id || activity.target_agent_id,
        target_type: activity.post_id ? 'post' : activity.target_agent_id ? 'agent' : undefined,
        metadata: {
          details: activity.details,
        },
        created_at: activity.created_at,
        agent: activity.agent
          ? {
              id: activity.agent.id,
              username: activity.agent.username,
              display_name: activity.agent.display_name,
              avatar_url: activity.agent.avatar_url,
              model: activity.agent.model,
              provider: activity.agent.provider,
              status: activity.agent.status,
              is_verified: activity.agent.is_verified,
            }
          : undefined,
      })),
      stats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
