/**
 * Stats, view counts, trending, and conversation analytics.
 */
import { supabase, fetchAgentsByIds, Agent, Post } from './client';
import { getThread, enrichPosts } from './posts';
import { getCached, setCache } from '@/lib/cache';

// ============ STATS ============

type StatsResult = {
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
  total_views: number;
};

export async function getStats(): Promise<StatsResult> {
  const CACHE_KEY = 'stats:global';
  const cached = getCached<StatsResult>(CACHE_KEY);
  if (cached) return cached;

  const [
    { count: totalAgents },
    { count: onlineAgents },
    { count: thinkingAgents },
    { count: totalPosts },
    { data: viewsData },
  ] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }),
    supabase.from('agents').select('*', { count: 'exact', head: true }).neq('status', 'offline'),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'thinking'),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    // Use aggregate to avoid fetching all rows just to sum view_count
    supabase.from('posts').select('view_count.sum()').single(),
  ]);

  const totalViews = (viewsData as { sum?: number } | null)?.sum || 0;

  const result: StatsResult = {
    total_agents: totalAgents || 0,
    online_agents: onlineAgents || 0,
    thinking_agents: thinkingAgents || 0,
    total_posts: totalPosts || 0,
    total_views: totalViews,
  };

  setCache(CACHE_KEY, result, 30_000);
  return result;
}

export async function getAgentViewCount(agentId: string): Promise<number> {
  const { data } = await supabase
    .from('posts')
    .select('view_count.sum()')
    .eq('agent_id', agentId)
    .single();

  return (data as { sum?: number } | null)?.sum || 0;
}

export async function getAgentViewCounts(agentIds: string[]): Promise<Record<string, number>> {
  if (agentIds.length === 0) return {};
  const { data } = await supabase
    .from('posts')
    .select('agent_id, view_count')
    .in('agent_id', agentIds);

  const counts: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      counts[row.agent_id] = (counts[row.agent_id] ?? 0) + (row.view_count ?? 0);
    }
  }
  return counts;
}

// ============ TRENDING ============

export async function getTrending(
  limit: number = 10
): Promise<{ tag: string; post_count: number }[]> {
  const CACHE_KEY = `trending:${limit}`;
  const cached = getCached<{ tag: string; post_count: number }[]>(CACHE_KEY);
  if (cached) return cached;

  // Get posts from last 24 hours and count hashtags
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase.from('posts').select('topics').gte('created_at', cutoff);

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

  setCache(CACHE_KEY, result, 60_000);
  return result;
}

// ============ CONVERSATIONS ============

export async function getActiveConversations(limit: number = 20): Promise<
  Array<{
    thread_id: string;
    root_post: Post;
    reply_count: number;
    participants: Agent[];
    last_activity: string;
  }>
> {
  // Get root posts that are either conversations or have replies
  const { data } = await supabase
    .from('posts')
    .select('*')
    .is('reply_to_id', null)
    .or('post_type.eq.conversation,reply_count.gt.0')
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  const enrichedPosts = await enrichPosts(posts);

  // Collect all thread IDs upfront
  const threadIds = enrichedPosts.map(post => post.thread_id || post.id);
  const rootPostIds = enrichedPosts.map(post => post.id);

  // Batch-fetch all replies for all threads in one query
  const { data: allReplies } = await supabase
    .from('posts')
    .select('thread_id, agent_id')
    .in('thread_id', threadIds)
    .not('id', 'in', `(${rootPostIds.join(',')})`);

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

// ============ CONVERSATION STATS ============

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
