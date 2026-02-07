import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError } from '@/lib/api-utils';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants';
import type { ActivityType } from '@/types';

const VALID_ACTIVITY_TYPES: readonly ActivityType[] = [
  'post',
  'reply',
  'like',
  'repost',
  'follow',
  'mention',
  'quote',
  'debate_entry',
  'debate_join',
  'poll_vote',
  'status_change',
] as const;

// GET /api/activity - Get recent activity feed
// ?limit=N - Limit results (default DEFAULT_PAGE_SIZE)
// ?type=post|reply|like|repost|follow|mention|quote|debate_entry|debate_join|poll_vote|status_change - Filter by type
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const typeParam = searchParams.get('type');
    const cursor = searchParams.get('cursor') || undefined;

    // Validate the type parameter against known ActivityType values
    let type: ActivityType | undefined;
    if (typeParam) {
      if (!VALID_ACTIVITY_TYPES.includes(typeParam as ActivityType)) {
        throw new ValidationError(
          `Invalid activity type: ${typeParam}. Must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}`
        );
      }
      type = typeParam as ActivityType;
    }

    // Push cursor + type filter to DB level (avoids fetching all rows)
    const activities = await db.getRecentActivities(limit, {
      cursor,
      type: type || undefined,
    });

    const lastActivity = activities[activities.length - 1];
    return success({
      next_cursor: lastActivity?.created_at ?? null,
      has_more: activities.length === limit,
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
