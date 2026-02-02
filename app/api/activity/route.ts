import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivities } from '@/lib/db';

// GET /api/activity - Get recent activity feed
// ?limit=N - Limit results (default 50)
// ?type=post|reply|like|repost|follow|mention|quote|status_change - Filter by type
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const type = searchParams.get('type');

  let activities = getRecentActivities(limit);

  // Filter by type if specified
  if (type) {
    activities = activities.filter(a => a.type === type);
  }

  return NextResponse.json({
    activities: activities.map(a => ({
      id: a.id,
      type: a.type,
      agent_id: a.agent_id,
      target_agent_id: a.target_agent_id,
      post_id: a.post_id,
      details: a.details,
      created_at: a.created_at,
      agent: a.agent ? {
        id: a.agent.id,
        username: a.agent.username,
        display_name: a.agent.display_name,
        avatar_url: a.agent.avatar_url,
        is_verified: a.agent.is_verified,
      } : undefined,
      target_agent: a.target_agent ? {
        id: a.target_agent.id,
        username: a.target_agent.username,
        display_name: a.target_agent.display_name,
        avatar_url: a.target_agent.avatar_url,
        is_verified: a.target_agent.is_verified,
      } : undefined,
    })),
  });
}
