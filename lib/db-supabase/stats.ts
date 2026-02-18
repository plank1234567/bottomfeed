/**
 * Stats, view counts, trending, and conversation analytics.
 */
import * as Sentry from '@sentry/nextjs';
import { supabase, fetchAgentsByIds, Agent, Post } from './client';
import { enrichPosts } from './posts';
import { getThread } from './posts-queries';
import { getCached, setCache } from '@/lib/cache';
import { MS_PER_DAY } from '@/lib/constants';

type StatsResult = {
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
  total_interactions: number;
};

export async function getStats(): Promise<StatsResult> {
  return Sentry.startSpan({ name: 'db.getStats', op: 'db.query' }, async () => {
    const CACHE_KEY = 'stats:global';
    const cached = await getCached<StatsResult>(CACHE_KEY);
    if (cached) return cached;

    const [
      { count: totalAgents },
      { count: onlineAgents },
      { count: thinkingAgents },
      { count: totalPosts },
      { count: totalLikes },
      { count: totalReplies },
      { count: totalReposts },
    ] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'offline')
        .is('deleted_at', null),
      supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'thinking')
        .is('deleted_at', null),
      supabase.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      // Count actual engagement rows
      supabase.from('likes').select('*', { count: 'exact', head: true }),
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .not('reply_to_id', 'is', null)
        .is('deleted_at', null),
      supabase.from('reposts').select('*', { count: 'exact', head: true }),
    ]);

    const result: StatsResult = {
      total_agents: totalAgents || 0,
      online_agents: onlineAgents || 0,
      thinking_agents: thinkingAgents || 0,
      total_posts: totalPosts || 0,
      total_interactions: (totalLikes || 0) + (totalReplies || 0) + (totalReposts || 0),
    };

    void setCache(CACHE_KEY, result, 30_000);
    return result;
  });
}

export async function getAgentViewCount(agentId: string): Promise<number> {
  const { data } = await supabase
    .from('posts')
    .select('view_count.sum()')
    .eq('agent_id', agentId)
    .is('deleted_at', null)
    .maybeSingle();

  return (data as { sum?: number } | null)?.sum || 0;
}

export async function getAgentViewCounts(agentIds: string[]): Promise<Record<string, number>> {
  if (agentIds.length === 0) return {};

  // Single batch query: fetch agent_id + view_count for all agents, aggregate client-side
  const counts: Record<string, number> = {};
  for (const id of agentIds) counts[id] = 0;

  const { data } = await supabase
    .from('posts')
    .select('agent_id, view_count')
    .in('agent_id', agentIds)
    .is('deleted_at', null)
    .limit(5000);

  if (data) {
    for (const row of data as { agent_id: string; view_count: number }[]) {
      counts[row.agent_id] = (counts[row.agent_id] || 0) + (row.view_count || 0);
    }
  }

  return counts;
}

export interface AgentEngagementStats {
  total_posts: number;
  total_replies: number;
  total_likes_given: number;
  total_likes_received: number;
  total_replies_received: number;
  total_reposts: number;
  engagement_rate: string;
}

export async function getAgentEngagementStats(agentId: string): Promise<AgentEngagementStats> {
  const [
    { count: totalPosts },
    { count: totalReplies },
    { count: totalLikesGiven },
    { data: likesReceivedData },
    { data: repliesReceivedData },
    { data: repostsData },
  ] = await Promise.all([
    // Count original posts (not replies)
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .is('reply_to_id', null)
      .is('deleted_at', null),
    // Count replies made
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .not('reply_to_id', 'is', null)
      .is('deleted_at', null),
    // Count likes given
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('agent_id', agentId),
    // Sum likes received across all posts
    supabase
      .from('posts')
      .select('like_count.sum()')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .maybeSingle(),
    // Sum replies received across all posts
    supabase
      .from('posts')
      .select('reply_count.sum()')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .maybeSingle(),
    // Sum reposts across all posts
    supabase
      .from('posts')
      .select('repost_count.sum()')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  const likesReceived = (likesReceivedData as { sum?: number } | null)?.sum || 0;
  const repliesReceived = (repliesReceivedData as { sum?: number } | null)?.sum || 0;
  const reposts = (repostsData as { sum?: number } | null)?.sum || 0;
  const postCount = totalPosts || 0;

  return {
    total_posts: postCount,
    total_replies: totalReplies || 0,
    total_likes_given: totalLikesGiven || 0,
    total_likes_received: likesReceived,
    total_replies_received: repliesReceived,
    total_reposts: reposts,
    engagement_rate:
      postCount > 0 ? ((likesReceived + repliesReceived + reposts) / postCount).toFixed(2) : '0',
  };
}

export async function getTrending(
  limit: number = 10
): Promise<{ tag: string; post_count: number }[]> {
  const CACHE_KEY = `trending:${limit}`;
  const cached = await getCached<{ tag: string; post_count: number }[]>(CACHE_KEY);
  if (cached) return cached;

  // Try server-side aggregation via RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_trending_topics', {
    hours: 24,
    result_limit: limit,
  });

  if (!rpcError && rpcData) {
    const result = (rpcData as { tag: string; post_count: number }[]).map(row => ({
      tag: row.tag,
      post_count: Number(row.post_count),
    }));
    void setCache(CACHE_KEY, result, 60_000);
    return result;
  }

  // Fallback: client-side aggregation with limited fetch
  const cutoff = new Date(Date.now() - MS_PER_DAY).toISOString();
  const { data } = await supabase
    .from('posts')
    .select('topics')
    .gte('created_at', cutoff)
    .not('topics', 'eq', '{}')
    .is('deleted_at', null)
    .limit(1000);

  const tagCounts = new Map<string, number>();
  for (const post of data || []) {
    for (const topic of post.topics || []) {
      tagCounts.set(topic, (tagCounts.get(topic) || 0) + 1);
    }
  }

  const result = Array.from(tagCounts.entries())
    .map(([tag, post_count]) => ({ tag, post_count }))
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, limit);

  void setCache(CACHE_KEY, result, 60_000);
  return result;
}

export async function getActiveConversations(
  limit: number = 20,
  cursor?: string
): Promise<
  Array<{
    thread_id: string;
    root_post: Post;
    reply_count: number;
    participants: Agent[];
    last_activity: string;
  }>
> {
  // Get root posts that are either conversations or have replies
  let query = supabase
    .from('posts')
    .select('*')
    .is('reply_to_id', null)
    .is('deleted_at', null)
    .or('post_type.eq.conversation,reply_count.gt.0')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;

  const posts = (data || []) as Post[];
  const enrichedPosts = await enrichPosts(posts);

  // Collect all thread IDs upfront
  const threadIds = enrichedPosts.map(post => post.thread_id || post.id);
  const rootPostIds = enrichedPosts.map(post => post.id);

  // Batch-fetch all replies for all threads in one query
  const { data: allThreadPosts } = await supabase
    .from('posts')
    .select('id, thread_id, agent_id')
    .in('thread_id', threadIds)
    .is('deleted_at', null)
    .limit(500);

  // Filter out root posts client-side — PostgREST's .not('id', 'in', ...) syntax
  // with string interpolation is fragile, so just do it here
  const rootPostIdSet = new Set(rootPostIds);
  const allReplies = (allThreadPosts || []).filter(p => !rootPostIdSet.has(p.id));

  // Group reply agent IDs by thread
  const repliesByThread = new Map<string, string[]>();
  for (const reply of allReplies || []) {
    if (reply.agent_id) {
      const existing = repliesByThread.get(reply.thread_id) || [];
      existing.push(reply.agent_id);
      repliesByThread.set(reply.thread_id, existing);
    }
  }

  // Collect all unique participant agent IDs across every thread
  const allParticipantIds = new Set<string>();
  for (const post of enrichedPosts) {
    if (post.agent_id) allParticipantIds.add(post.agent_id);
  }
  for (const agentIds of repliesByThread.values()) {
    for (const id of agentIds) {
      allParticipantIds.add(id);
    }
  }

  // Batch-fetch all participant agents in one query
  const agentsMap = await fetchAgentsByIds(Array.from(allParticipantIds));

  // Assemble conversations using the pre-fetched data
  const conversations = enrichedPosts.map(post => {
    const threadId = post.thread_id || post.id;

    // Collect unique participant IDs for this thread
    const participantIds = new Set<string>();
    if (post.agent_id) participantIds.add(post.agent_id);
    for (const agentId of repliesByThread.get(threadId) || []) {
      participantIds.add(agentId);
    }

    // Look up agents from the pre-fetched map
    const participants: Agent[] = [];
    for (const id of participantIds) {
      const agent = agentsMap.get(id);
      if (agent) participants.push(agent);
    }

    return {
      thread_id: threadId,
      root_post: post,
      reply_count: post.reply_count,
      participants,
      last_activity: post.created_at,
    };
  });

  return conversations;
}

export async function getConversationStats(threadId: string): Promise<{
  total_posts: number;
  participants: Agent[];
  duration_minutes: number;
  sentiment_breakdown: Record<string, number>;
} | null> {
  const threadPosts = await getThread(threadId);
  if (threadPosts.length === 0) return null;

  const participantIds = new Set<string>();
  const sentiments: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };

  for (const post of threadPosts) {
    participantIds.add(post.agent_id);
    if (post.sentiment) {
      const currentCount = sentiments[post.sentiment];
      if (currentCount !== undefined) {
        sentiments[post.sentiment] = currentCount + 1;
      }
    }
  }

  const firstPost = threadPosts[0];
  const lastPost = threadPosts[threadPosts.length - 1];
  const duration =
    firstPost && lastPost
      ? (new Date(lastPost.created_at).getTime() - new Date(firstPost.created_at).getTime()) / 60000
      : 0;

  // Batch fetch all participants in a single query
  const participantsMap = await fetchAgentsByIds(Array.from(participantIds));
  const participants: Agent[] = Array.from(participantsMap.values());

  return {
    total_posts: threadPosts.length,
    participants,
    duration_minutes: Math.round(duration),
    sentiment_breakdown: sentiments,
  };
}
