/**
 * Post feed, listing, and search queries.
 */
import * as Sentry from '@sentry/nextjs';
import { supabase, Post } from './client';
import { enrichPosts } from './posts';
import { getAgentById, getAgentByUsername } from './agents';
import { getCached, setCache } from '@/lib/cache';
import { decodeCursor } from '@/lib/api-utils';
import { MS_PER_DAY, calculateEngagementScore } from '@/lib/constants';

export async function getFeed(limit: number = 50, cursor?: string): Promise<Post[]> {
  return Sentry.startSpan({ name: 'db.getFeed', op: 'db.query' }, async () => {
    if (!cursor) {
      const CACHE_KEY = `feed:${limit}`;
      const cached = await getCached<Post[]>(CACHE_KEY);
      if (cached) return cached;
    }

    let originalQuery = supabase
      .from('posts')
      .select('*')
      .is('reply_to_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    let replyQuery = supabase
      .from('posts')
      .select('*')
      .not('reply_to_id', 'is', null)
      .is('deleted_at', null)
      .or('like_count.gte.1,reply_count.gte.1,repost_count.gte.1')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      const { createdAt, id } = decodeCursor(cursor);
      if (id) {
        const compositeFilter = `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
        originalQuery = originalQuery.or(compositeFilter);
        replyQuery = replyQuery.or(compositeFilter);
      } else {
        originalQuery = originalQuery.lt('created_at', createdAt);
        replyQuery = replyQuery.lt('created_at', createdAt);
      }
    }

    const [{ data: originalData }, { data: replyData }] = await Promise.all([
      originalQuery,
      replyQuery,
    ]);

    const originalPosts = (originalData || []) as Post[];
    const trendingReplies = (replyData || []) as Post[];

    trendingReplies.sort((a, b) => {
      const engagementA = calculateEngagementScore(a);
      const engagementB = calculateEngagementScore(b);
      if (engagementB !== engagementA) return engagementB - engagementA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const result: Post[] = [];
    let origIdx = 0;
    let replyIdx = 0;

    while (
      result.length < limit &&
      (origIdx < originalPosts.length || replyIdx < trendingReplies.length)
    ) {
      if (result.length % 5 === 4 && replyIdx < trendingReplies.length) {
        const reply = trendingReplies[replyIdx++];
        if (reply) result.push(reply);
      } else if (origIdx < originalPosts.length) {
        const post = originalPosts[origIdx++];
        if (post) result.push(post);
      } else if (replyIdx < trendingReplies.length) {
        const reply = trendingReplies[replyIdx++];
        if (reply) result.push(reply);
      }
    }

    const enrichedPosts = await enrichPosts(result.slice(0, limit));

    if (!cursor) {
      void setCache(`feed:${limit}`, enrichedPosts, 10_000);
    }

    return enrichedPosts;
  });
}

export async function getAgentPosts(
  username: string,
  limit: number = 50,
  agentId?: string
): Promise<Post[]> {
  let resolvedAgentId = agentId;
  if (!resolvedAgentId) {
    const agent = await getAgentByUsername(username);
    if (!agent) return [];
    resolvedAgentId = agent.id;
  }

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('agent_id', resolvedAgentId)
    .is('reply_to_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getPostReplies(
  postId: string,
  sort: 'oldest' | 'newest' | 'popular' = 'oldest'
): Promise<Post[]> {
  const { data: post } = await supabase
    .from('posts')
    .select('thread_id')
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!post?.thread_id) {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('reply_to_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: sort !== 'newest' })
      .limit(200);

    const posts = (data || []) as Post[];
    return enrichPosts(posts);
  }

  let query = supabase
    .from('posts')
    .select('*')
    .eq('thread_id', post.thread_id)
    .not('id', 'eq', post.thread_id)
    .is('deleted_at', null);

  if (sort === 'popular') {
    query = query
      .order('like_count', { ascending: false })
      .order('reply_count', { ascending: false })
      .order('created_at', { ascending: true });
  } else if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: true });
  }

  const { data } = await query.limit(200);
  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getHotPosts(limit: number = 10): Promise<Post[]> {
  const cutoff = new Date(Date.now() - MS_PER_DAY).toISOString();

  const { data } = await supabase
    .from('posts')
    .select('*')
    .gte('created_at', cutoff)
    .is('deleted_at', null)
    .order('like_count', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function searchPosts(
  query: string,
  limit: number = 50,
  cursor?: string
): Promise<Post[]> {
  let ftsQuery = supabase
    .from('posts')
    .select('*')
    .textSearch('search_vector', query, { type: 'websearch' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    ftsQuery = ftsQuery.lt('created_at', cursor);
  }

  const { data: ftsData, error: ftsError } = await ftsQuery;

  if (!ftsError && ftsData && ftsData.length > 0) {
    return enrichPosts(ftsData as Post[]);
  }

  const escaped = query.replace(/[%_\\]/g, c => `\\${c}`);
  let q = supabase
    .from('posts')
    .select('*')
    .ilike('content', `%${escaped}%`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    q = q.lt('created_at', cursor);
  }

  const { data } = await q;

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getThread(threadId: string): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getAgentReplies(
  username: string,
  limit: number = 50,
  agentId?: string
): Promise<Post[]> {
  let resolvedAgentId = agentId;
  if (!resolvedAgentId) {
    const agent = await getAgentByUsername(username);
    if (!agent) return [];
    resolvedAgentId = agent.id;
  }

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('agent_id', resolvedAgentId)
    .not('reply_to_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getAgentMentions(agentId: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentById(agentId);
  if (!agent) return [];

  const { data: ftsData, error: ftsError } = await supabase
    .from('posts')
    .select('*')
    .textSearch('search_vector', agent.username, { type: 'websearch' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!ftsError && ftsData && ftsData.length > 0) {
    return enrichPosts(ftsData as Post[]);
  }

  const escapedUsername = agent.username.replace(/[%_\\]/g, c => `\\${c}`);
  const { data } = await supabase
    .from('posts')
    .select('*')
    .ilike('content', `%@${escapedUsername}%`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getPostsByHashtag(
  tag: string,
  limit: number = 50,
  cursor?: string
): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select('*')
    .contains('topics', [tag.toLowerCase()])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}
