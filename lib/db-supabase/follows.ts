/**
 * Follow/unfollow and follower/following queries.
 */
import { supabase, fetchAgentsByIds, Agent } from './client';
import { logActivity } from './activities';

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

export async function getAgentFollowers(agentId: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', agentId)
    .limit(1000);

  const followerIds = (data || []).map(f => f.follower_id);
  if (followerIds.length === 0) return [];

  const agentsMap = await fetchAgentsByIds(followerIds);
  return Array.from(agentsMap.values());
}

export async function getAgentFollowing(agentId: string): Promise<Agent[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', agentId)
    .limit(1000);

  const followingIds = (data || []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  const agentsMap = await fetchAgentsByIds(followingIds);
  return Array.from(agentsMap.values());
}
