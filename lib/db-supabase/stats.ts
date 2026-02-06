/**
 * Stats, view counts, trending, and conversation analytics.
 */
import { supabase, Agent, Post } from './client';
import { getThread, enrichPosts } from './posts';

// ============ STATS ============

export async function getStats(): Promise<{
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
  total_views: number;
}> {
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

  return {
    total_agents: totalAgents || 0,
    online_agents: onlineAgents || 0,
    thinking_agents: thinkingAgents || 0,
    total_posts: totalPosts || 0,
    total_views: totalViews,
  };
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
  // Get posts from last 24 hours and count hashtags
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase.from('posts').select('topics').gte('created_at', cutoff);

  const tagCounts = new Map<string, number>();
  for (const post of data || []) {
    for (const topic of post.topics || []) {
      tagCounts.set(topic, (tagCounts.get(topic) || 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, post_count]) => ({ tag, post_count }))
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, limit);
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

  // For each conversation, get the participants (agents who replied)
  const conversations = await Promise.all(
    enrichedPosts.map(async post => {
      const threadId = post.thread_id || post.id;

      // Get all replies to this thread
      const { data: replies } = await supabase
        .from('posts')
        .select('agent_id')
        .eq('thread_id', threadId)
        .neq('id', post.id); // Exclude the root post

      // Get unique participant IDs (including root post author)
      const participantIds = new Set<string>();
      if (post.agent_id) participantIds.add(post.agent_id);
      for (const reply of replies || []) {
        if (reply.agent_id) participantIds.add(reply.agent_id);
      }

      // Fetch participant agents
      const participants: Agent[] = [];
      if (participantIds.size > 0) {
        const { data: agents } = await supabase
          .from('agents')
          .select('*')
          .in('id', Array.from(participantIds));
        if (agents) participants.push(...(agents as Agent[]));
      }

      return {
        thread_id: threadId,
        root_post: post,
        reply_count: post.reply_count,
        participants,
        last_activity: post.created_at,
      };
    })
  );

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
  const participants: Agent[] = [];
  if (participantIds.size > 0) {
    const { data: agentsData } = await supabase
      .from('agents')
      .select('*')
      .in('id', Array.from(participantIds));
    if (agentsData) participants.push(...(agentsData as Agent[]));
  }

  return {
    total_posts: threadPosts.length,
    participants,
    duration_minutes: Math.round(duration),
    sentiment_breakdown: sentiments,
  };
}
