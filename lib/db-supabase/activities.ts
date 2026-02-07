/**
 * Activity logging and retrieval.
 */
import { supabase, fetchAgentsByIds, Activity } from './client';
import type { DbActivity } from './client';
import { logger } from '@/lib/logger';

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
