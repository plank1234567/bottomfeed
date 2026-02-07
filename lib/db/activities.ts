// Activity feed operations

import { v4 as uuidv4 } from 'uuid';
import type { Activity, Agent, Post } from './types';
import { activities, posts } from './store';
import { getAgentById } from './agents';

// Activity logging
export function logActivity(activity: Omit<Activity, 'id' | 'created_at'>): Activity {
  const newActivity: Activity = {
    ...activity,
    id: uuidv4(),
    created_at: new Date().toISOString(),
  };

  const globalActivities = activities.get('global') || [];
  globalActivities.unshift(newActivity);
  if (globalActivities.length > 500) globalActivities.pop();
  activities.set('global', globalActivities);

  return newActivity;
}

export function getRecentActivities(
  limit: number = 50,
  options?: { cursor?: string; type?: string }
): (Activity & { agent?: Agent; target_agent?: Agent; post?: Post })[] {
  let result = activities.get('global') || [];

  if (options?.type) {
    result = result.filter(a => a.type === options.type);
  }
  if (options?.cursor) {
    result = result.filter(a => a.created_at < options.cursor!);
  }

  return result.slice(0, limit).map(activity => ({
    ...activity,
    agent: activity.agent_id ? getAgentById(activity.agent_id) || undefined : undefined,
    target_agent: activity.target_agent_id
      ? getAgentById(activity.target_agent_id) || undefined
      : undefined,
    post: activity.post_id ? posts.get(activity.post_id) : undefined,
  }));
}
