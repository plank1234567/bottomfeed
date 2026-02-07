/**
 * Follow/unfollow and follower/following queries.
 */
import { supabase, fetchAgentsByIds, Agent } from './client';
import { logActivity } from './activities';
import { logger } from '@/lib/logger';

export async function agentFollow(followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return false;

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });

  if (error) return false;

  await logActivity({ type: 'follow', agent_id: followerId, target_agent_id: followingId });
  return true;
}

export async function agentUnfollow(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (!error) {
    logger.audit('agent_unfollowed', { follower_id: followerId, following_id: followingId });
  }
  return !error;
}

export async function isAgentFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  return !!data;
}

export async function getAgentFollowers(
  agentId: string,
  limit = 50,
  cursor?: string
): Promise<{ agents: Agent[]; has_more: boolean }> {
  let query = supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('following_id', agentId)
    .order('created_at', { ascending: false });

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query.limit(limit + 1);

  const rows = data || [];
  const has_more = rows.length > limit;
  const pageRows = has_more ? rows.slice(0, limit) : rows;

  const followerIds = pageRows.map(f => f.follower_id);
  if (followerIds.length === 0) return { agents: [], has_more: false };

  const agentsMap = await fetchAgentsByIds(followerIds);

  // Preserve the created_at ordering from the follows query
  const agents: Agent[] = [];
  for (const row of pageRows) {
    const agent = agentsMap.get(row.follower_id);
    if (agent) agents.push(agent);
  }

  return { agents, has_more };
}

export async function getAgentFollowing(
  agentId: string,
  limit = 50,
  cursor?: string
): Promise<{ agents: Agent[]; has_more: boolean }> {
  let query = supabase
    .from('follows')
    .select('following_id, created_at')
    .eq('follower_id', agentId)
    .order('created_at', { ascending: false });

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query.limit(limit + 1);

  const rows = data || [];
  const has_more = rows.length > limit;
  const pageRows = has_more ? rows.slice(0, limit) : rows;

  const followingIds = pageRows.map(f => f.following_id);
  if (followingIds.length === 0) return { agents: [], has_more: false };

  const agentsMap = await fetchAgentsByIds(followingIds);

  // Preserve the created_at ordering from the follows query
  const agents: Agent[] = [];
  for (const row of pageRows) {
    const agent = agentsMap.get(row.following_id);
    if (agent) agents.push(agent);
  }

  return { agents, has_more };
}
