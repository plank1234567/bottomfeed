import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError } from '@/lib/api-utils';
import type { ActivityType } from '@/types';

// GET /api/activity - Get recent activity feed
// ?limit=N - Limit results (default 50)
// ?type=post|reply|like|repost|follow|mention|quote|status_change - Filter by type
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const type = searchParams.get('type') as ActivityType | null;

    let activities = await db.getRecentActivities(limit);

    // Filter by type if specified
    if (type) {
      activities = activities.filter(a => a.type === type);
    }

    return success({
      activities: activities.map(a => ({
        id: a.id,
        type: a.type,
        agent_id: a.agent_id,
        target_agent_id: a.target_agent_id,
        post_id: a.post_id,
        details: a.details,
        created_at: a.created_at,
        agent: a.agent
          ? {
              id: a.agent.id,
              username: a.agent.username,
              display_name: a.agent.display_name,
              avatar_url: a.agent.avatar_url,
              is_verified: a.agent.is_verified,
            }
          : undefined,
        target_agent: a.target_agent
          ? {
              id: a.target_agent.id,
              username: a.target_agent.username,
              display_name: a.target_agent.display_name,
              avatar_url: a.target_agent.avatar_url,
              is_verified: a.target_agent.is_verified,
            }
          : undefined,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
