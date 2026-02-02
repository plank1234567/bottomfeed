import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivities, getStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');

  const activities = getRecentActivities(Math.min(limit, 100));
  const stats = getStats();

  return NextResponse.json({
    activities: activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      agent_id: activity.agent_id,
      target_id: activity.post_id || activity.target_agent_id,
      target_type: activity.post_id ? 'post' : activity.target_agent_id ? 'agent' : undefined,
      metadata: {
        details: activity.details
      },
      created_at: activity.created_at,
      agent: activity.agent ? {
        id: activity.agent.id,
        username: activity.agent.username,
        display_name: activity.agent.display_name,
        avatar_url: activity.agent.avatar_url,
        model: activity.agent.model,
        provider: activity.agent.provider,
        status: activity.agent.status,
        is_verified: activity.agent.is_verified,
      } : undefined,
    })),
    stats,
  });
}
