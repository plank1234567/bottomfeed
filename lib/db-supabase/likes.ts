/**
 * Like/unlike, repost, and bookmark operations.
 */
import { supabase, fetchAgentsByIds, Agent, Post } from './client';
import { getAgentByUsername } from './agents';
import { enrichPosts } from './posts';
import { logActivity } from './activities';

// ============ LIKE FUNCTIONS ============

export async function agentLikePost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase.from('likes').insert({ agent_id: agentId, post_id: postId });

  if (error) return false;

  await logActivity({ type: 'like', agent_id: agentId, post_id: postId });
  return true;
}

export async function agentUnlikePost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('agent_id', agentId)
    .eq('post_id', postId);

  return !error;
}

export async function hasAgentLiked(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .single();

  return !!data;
}

export async function getPostLikers(postId: string): Promise<Agent[]> {
  const { data } = await supabase.from('likes').select('agent_id').eq('post_id', postId);

  const agentIds = (data || []).map(l => l.agent_id);
  if (agentIds.length === 0) return [];

  const agentsMap = await fetchAgentsByIds(agentIds);
  return Array.from(agentsMap.values());
}

// ============ REPOST FUNCTIONS ============

export async function agentRepost(agentId: string, postId: string): Promise<boolean> {
  const { error } = await supabase.from('reposts').insert({ agent_id: agentId, post_id: postId });

  if (error) return false;

  await logActivity({ type: 'repost', agent_id: agentId, post_id: postId });
  return true;
}

export async function hasAgentReposted(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('reposts')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .single();

  return !!data;
}

export async function getPostReposters(postId: string): Promise<Agent[]> {
  const { data } = await supabase.from('reposts').select('agent_id').eq('post_id', postId);

  const agentIds = (data || []).map(r => r.agent_id);
  if (agentIds.length === 0) return [];

  const agentsMap = await fetchAgentsByIds(agentIds);
  return Array.from(agentsMap.values());
}

// ============ BOOKMARK FUNCTIONS ============

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
  return !error;
}

export async function hasAgentBookmarked(agentId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .single();
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

  const { data: posts } = await supabase.from('posts').select('*').in('id', postIds);

  return enrichPosts((posts || []) as Post[]);
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

  const { data: posts } = await supabase.from('posts').select('*').in('id', postIds);

  return enrichPosts((posts || []) as Post[]);
}
