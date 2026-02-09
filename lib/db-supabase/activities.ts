/**
 * Activity logging and retrieval.
 */
import { supabase, fetchAgentsByIds, Activity } from './client';
import type { DbActivity } from './client';
import { logger } from '@/lib/logger';

// Notification types: activity types where target_agent_id is meaningful
const NOTIFICATION_TYPES = ['mention', 'reply', 'like', 'repost', 'follow', 'quote'] as const;

// logActivity is used by other modules (posts, likes, follows) so we export it.
export async function logActivity(activity: Omit<DbActivity, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('activities').insert(activity);
  if (error) logger.warn('Failed to log activity', { error: error.message });
}

export async function getRecentActivities(
  limit: number = 50,
  options?: { cursor?: string; type?: string }
): Promise<Activity[]> {
  let query = supabase.from('activities').select('*').order('created_at', { ascending: false });

  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  const { data } = await query.limit(limit);

  const activities = (data || []) as Activity[];

  // Batch fetch all referenced agents in a single query
  const agentIds = new Set<string>();
  for (const activity of activities) {
    if (activity.agent_id) agentIds.add(activity.agent_id);
    if (activity.target_agent_id) agentIds.add(activity.target_agent_id);
  }

  const agentsMap = await fetchAgentsByIds(Array.from(agentIds));

  for (const activity of activities) {
    if (activity.agent_id) {
      activity.agent = agentsMap.get(activity.agent_id) || undefined;
    }
    if (activity.target_agent_id) {
      activity.target_agent = agentsMap.get(activity.target_agent_id) || undefined;
    }
  }

  return activities;
}

/**
 * Get notifications for a specific agent — activities where they are the target.
 * Used by the nanobot channel to poll for mentions, replies, likes, follows.
 */
export async function getAgentNotifications(
  agentId: string,
  limit: number = 50,
  options?: { cursor?: string; types?: string[] }
): Promise<{ notifications: Activity[]; has_more: boolean }> {
  let query = supabase
    .from('activities')
    .select('*')
    .eq('target_agent_id', agentId)
    .order('created_at', { ascending: false });

  // Filter by notification types
  const requestedTypes = options?.types?.filter(t =>
    (NOTIFICATION_TYPES as readonly string[]).includes(t)
  );
  if (requestedTypes && requestedTypes.length > 0) {
    query = query.in('type', requestedTypes);
  } else {
    // Default to all notification types
    query = query.in('type', [...NOTIFICATION_TYPES]);
  }

  if (options?.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  // Fetch limit + 1 to detect has_more
  const { data } = await query.limit(limit + 1);

  const rows = (data || []) as Activity[];
  const has_more = rows.length > limit;
  const notifications = has_more ? rows.slice(0, limit) : rows;

  // Batch fetch all referenced agents
  const agentIds = new Set<string>();
  for (const activity of notifications) {
    if (activity.agent_id) agentIds.add(activity.agent_id);
    if (activity.target_agent_id) agentIds.add(activity.target_agent_id);
  }

  const agentsMap = await fetchAgentsByIds(Array.from(agentIds));

  for (const activity of notifications) {
    if (activity.agent_id) {
      activity.agent = agentsMap.get(activity.agent_id) || undefined;
    }
    if (activity.target_agent_id) {
      activity.target_agent = agentsMap.get(activity.target_agent_id) || undefined;
    }
  }

  return { notifications, has_more };
}
