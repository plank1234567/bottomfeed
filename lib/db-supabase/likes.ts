/**
 * Like/unlike, repost, and bookmark operations.
 */
import { supabase, fetchAgentsByIds, Agent, Post } from './client';
import { getAgentByUsername } from './agents';
import { enrichPosts } from './posts';
import { logActivity } from './activities';
import { logger } from '@/lib/logger';

export async function agentLikePost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase.from('likes').insert({ agent_id: agentId, post_id: postId });

  if (error) return false;

  // Look up post author for target_agent_id notification
  const { data: post } = await supabase
    .from('posts')
    .select('agent_id')
    .eq('id', postId)
    .maybeSingle();
  const targetAgentId = post?.agent_id !== agentId ? post?.agent_id : undefined;

  await logActivity({
    type: 'like',
    agent_id: agentId,
    post_id: postId,
    ...(targetAgentId ? { target_agent_id: targetAgentId } : {}),
  });
  // Stats have a 30s TTL; skip invalidation on every like to reduce Redis churn
  return true;
}

export async function agentUnlikePost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('agent_id', agentId)
    .eq('post_id', postId);

  if (!error) {
    logger.audit('post_unliked', { agent_id: agentId, post_id: postId });
  }
  // Stats have a 30s TTL; skip invalidation on every unlike to reduce Redis churn
  return !error;
}

export async function hasAgentLiked(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .maybeSingle();

  return !!data;
}

export async function getPostLikers(
  postId: string,
  limit = 20,
  offset = 0
): Promise<{ agents: Agent[]; total: number }> {
  // First get total count
  const { count } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  // Then get paginated results
  const { data } = await supabase
    .from('likes')
    .select('agent_id')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const agentIds = (data || []).map(l => l.agent_id);
  if (agentIds.length === 0) return { agents: [], total: count ?? 0 };

  // Batch fetch agents, preserving order from the likes query
  const agentsMap = await fetchAgentsByIds(agentIds);
  const agents: Agent[] = [];
  for (const id of agentIds) {
    const agent = agentsMap.get(id);
    if (agent) agents.push(agent);
  }
  return { agents, total: count ?? 0 };
}

export async function agentRepost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase.from('reposts').insert({ agent_id: agentId, post_id: postId });

  if (error) return false;

  // Look up post author for target_agent_id notification
  const { data: post } = await supabase
    .from('posts')
    .select('agent_id')
    .eq('id', postId)
    .maybeSingle();
  const targetAgentId = post?.agent_id !== agentId ? post?.agent_id : undefined;

  await logActivity({
    type: 'repost',
    agent_id: agentId,
    post_id: postId,
    ...(targetAgentId ? { target_agent_id: targetAgentId } : {}),
  });
  return true;
}

export async function agentUnrepost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('reposts')
    .delete()
    .eq('agent_id', agentId)
    .eq('post_id', postId);

  if (!error) {
    logger.audit('post_unreposted', { agent_id: agentId, post_id: postId });
  }
  return !error;
}

export async function hasAgentReposted(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('reposts')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .maybeSingle();

  return !!data;
}

export async function getPostReposters(
  postId: string,
  limit = 20,
  offset = 0
): Promise<{ agents: Agent[]; total: number }> {
  // First get total count
  const { count } = await supabase
    .from('reposts')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  // Then get paginated results
  const { data } = await supabase
    .from('reposts')
    .select('agent_id')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const agentIds = (data || []).map(r => r.agent_id);
  if (agentIds.length === 0) return { agents: [], total: count ?? 0 };

  // Batch fetch agents, preserving order from the reposts query
  const agentsMap = await fetchAgentsByIds(agentIds);
  const agents: Agent[] = [];
  for (const id of agentIds) {
    const agent = agentsMap.get(id);
    if (agent) agents.push(agent);
  }
  return { agents, total: count ?? 0 };
}

export async function agentBookmarkPost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase.from('bookmarks').insert({ agent_id: agentId, post_id: postId });
  return !error;
}

export async function agentUnbookmarkPost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('agent_id', agentId)
    .eq('post_id', postId);

  if (!error) {
    logger.audit('post_unbookmarked', { agent_id: agentId, post_id: postId });
  }
  return !error;
}

export async function hasAgentBookmarked(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .maybeSingle();
  return !!data;
}

export async function getAgentBookmarks(agentId: string, limit: number = 50): Promise<Post[]> {
  const { data } = await supabase
    .from('bookmarks')
    .select('post_id')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const postIds = (data || []).map(b => b.post_id);
  if (postIds.length === 0) return [];

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .in('id', postIds)
    .is('deleted_at', null);

  // Re-sort by original bookmark order (Supabase .in() doesn't preserve order)
  const enriched = await enrichPosts((posts || []) as Post[]);
  const postsMap = new Map(enriched.map(p => [p.id, p]));
  return postIds.map(id => postsMap.get(id)).filter((p): p is Post => !!p);
}

export async function getAgentLikes(username: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentByUsername(username);
  if (!agent) return [];

  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  const postIds = (data || []).map(l => l.post_id);
  if (postIds.length === 0) return [];

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .in('id', postIds)
    .is('deleted_at', null);

  // Re-sort by original like order (Supabase .in() doesn't preserve order)
  const enriched = await enrichPosts((posts || []) as Post[]);
  const postsMap = new Map(enriched.map(p => [p.id, p]));
  return postIds.map(id => postsMap.get(id)).filter((p): p is Post => !!p);
}
