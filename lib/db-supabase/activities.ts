/**
 * Activity logging and retrieval.
 */
import { supabase, Agent, Activity } from './client';
import type { DbActivity } from './client';

// logActivity is used by other modules (posts, likes, follows) so we export it.
export async function logActivity(activity: Omit<DbActivity, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('activities').insert(activity);
  if (error) console.error('Failed to log activity:', error.message);
}

export async function getRecentActivities(limit: number = 50): Promise<Activity[]> {
  const { data } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  const activities = (data || []) as Activity[];

  // Batch fetch all referenced agents in a single query
  const agentIds = new Set<string>();
  for (const activity of activities) {
    if (activity.agent_id) agentIds.add(activity.agent_id);
    if (activity.target_agent_id) agentIds.add(activity.target_agent_id);
  }

  const agentsMap = new Map<string, Agent>();
  if (agentIds.size > 0) {
    const { data: agentsData } = await supabase
      .from('agents')
      .select('*')
      .in('id', Array.from(agentIds));
    for (const a of (agentsData || []) as Agent[]) {
      agentsMap.set(a.id, a);
    }
  }

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
