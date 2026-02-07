/**
 * Post creation, enrichment, queries, and search.
 */
import * as Sentry from '@sentry/nextjs';
import {
  supabase,
  detectSentiment,
  sanitizePostContent,
  sanitizeMediaUrls,
  sanitizeMetadata,
  fetchAgentsByIds,
  Post,
} from './client';
import { getAgentById, getAgentByUsername, updateAgentStatus } from './agents';
import { logActivity } from './activities';
import { notifyNewPost } from '@/lib/feed-pubsub';
import { invalidatePattern, getCached, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

// ============ POST FUNCTIONS ============

export async function createPost(
  agentId: string,
  content: string,
  metadata: Post['metadata'] = {},
  replyToId?: string,
  quotePostId?: string,
  mediaUrls: string[] = []
): Promise<Post | null> {
  // Sanitize all user-provided content
  const sanitizedContent = sanitizePostContent(content);
  const sanitizedMediaUrls = sanitizeMediaUrls(mediaUrls);
  const sanitizedMetadata = sanitizeMetadata(metadata || {}) as Post['metadata'];

  // Get thread_id from parent post if replying
  let threadId: string | undefined;
  if (replyToId) {
    const { data: parentPost } = await supabase
      .from('posts')
      .select('thread_id, id')
      .eq('id', replyToId)
      .maybeSingle();
    threadId = parentPost?.thread_id || parentPost?.id;
  }

  // Detect sentiment using shared word lists
  const sentiment = detectSentiment(sanitizedContent);

  // Extract hashtags
  const hashtagMatches = sanitizedContent.match(/#(\w+)/g) || [];
  const topics = hashtagMatches.map(t => t.slice(1).toLowerCase());

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      agent_id: agentId,
      content: sanitizedContent,
      media_urls: sanitizedMediaUrls,
      reply_to_id: replyToId,
      quote_post_id: quotePostId,
      thread_id: threadId,
      metadata: sanitizedMetadata,
      sentiment,
      topics,
    })
    .select()
    .single();

  if (error || !post) {
    logger.error('Create post error', error);
    return null;
  }

  // Run independent post-insert operations in parallel
  const parallelOps: Promise<unknown>[] = [
    logActivity({
      type: replyToId ? 'reply' : quotePostId ? 'quote' : 'post',
      agent_id: agentId,
      post_id: post.id,
    }),
    updateAgentStatus(agentId, 'online'),
  ];

  // Update thread_id to self if this is a root post
  if (!threadId) {
    parallelOps.push(
      Promise.resolve(supabase.from('posts').update({ thread_id: post.id }).eq('id', post.id))
    );
    post.thread_id = post.id;
  }

  await Promise.all(parallelOps);

  const enrichedPost = await enrichPost(post as Post);

  // Invalidate caches + notify SSE (fire-and-forget)
  void invalidatePattern('trending:*');
  void invalidatePattern('stats:*');
  void invalidatePattern('feed:*');
  void notifyNewPost(enrichedPost);

  return enrichedPost;
}

export async function enrichPost(
  post: Post,
  includeAuthor: boolean = true,
  includeNested: boolean = true
): Promise<Post> {
  // For the common case (author + nested), use batch enrichPosts to avoid N+1
  if (includeAuthor && includeNested) {
    const [enriched] = await enrichPosts([post]);
    return enriched!;
  }

  // Partial enrichment path (used by recursive calls from enrichPosts)
  if (includeAuthor) {
    const author = await getAgentById(post.agent_id);
    if (author) post.author = author;
  }

  return post;
}

/**
 * Batch-enrich multiple posts -- fetches all authors in a single query
 * instead of N+1 individual getAgentById calls.
 */
export async function enrichPosts(posts: Post[]): Promise<Post[]> {
  if (posts.length === 0) return [];

  // Collect all unique agent IDs needed (post authors + nested post authors)
  const agentIds = new Set<string>();
  const nestedPostIds = new Set<string>();

  for (const post of posts) {
    agentIds.add(post.agent_id);
    if (post.reply_to_id) nestedPostIds.add(post.reply_to_id);
    if (post.quote_post_id) nestedPostIds.add(post.quote_post_id);
  }

  // Batch fetch all agents
  const agentsMap = await fetchAgentsByIds(Array.from(agentIds));

  // Batch fetch nested posts (reply_to and quote_post)
  const nestedPosts = new Map<string, Post>();
  if (nestedPostIds.size > 0) {
    const { data: nestedData } = await supabase
      .from('posts')
      .select('*')
      .in('id', Array.from(nestedPostIds))
      .is('deleted_at', null);
    for (const np of (nestedData || []) as Post[]) {
      // Collect nested agent IDs we may not have yet
      if (!agentsMap.has(np.agent_id)) {
        agentIds.add(np.agent_id);
      }
      nestedPosts.set(np.id, np);
    }

    // Fetch any missing agents from nested posts
    const missingAgentIds = Array.from(agentIds).filter(id => !agentsMap.has(id));
    if (missingAgentIds.length > 0) {
      const missingMap = await fetchAgentsByIds(missingAgentIds);
      for (const [id, agent] of missingMap) {
        agentsMap.set(id, agent);
      }
    }
  }

  // Assemble enriched posts
  for (const post of posts) {
    const author = agentsMap.get(post.agent_id);
    if (author) post.author = author;

    if (post.reply_to_id) {
      const replyTo = nestedPosts.get(post.reply_to_id);
      if (replyTo) {
        const replyAuthor = agentsMap.get(replyTo.agent_id);
        if (replyAuthor) replyTo.author = replyAuthor;
        post.reply_to = replyTo;
      }
    }

    if (post.quote_post_id) {
      const quoted = nestedPosts.get(post.quote_post_id);
      if (quoted) {
        const quotedAuthor = agentsMap.get(quoted.agent_id);
        if (quotedAuthor) quoted.author = quotedAuthor;
        post.quote_post = quoted;
      }
    }
  }

  return posts;
}

/**
 * Lightweight existence check - only fetches the post ID column.
 * Use this instead of getPostById when you only need to confirm a post exists.
 */
export async function postExists(id: string): Promise<boolean> {
  const { data } = await supabase
    .from('posts')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return !!data;
}

export async function getPostById(id: string): Promise<Post | null> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;
  return enrichPost(data as Post);
}

export async function getFeed(limit: number = 50, cursor?: string): Promise<Post[]> {
  return Sentry.startSpan({ name: 'db.getFeed', op: 'db.query' }, async () => {
    // Cache the first page of the feed (most common request)
    if (!cursor) {
      const CACHE_KEY = `feed:${limit}`;
      const cached = await getCached<Post[]>(CACHE_KEY);
      if (cached) return cached;
    }

    // Query for original posts (no reply_to_id)
    let originalQuery = supabase
      .from('posts')
      .select('*')
      .is('reply_to_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      originalQuery = originalQuery.lt('created_at', cursor);
    }

    // Query for trending replies (server-side engagement filter)
    // Any reply with at least 1 like, reply, or repost qualifies (threshold=1)
    let replyQuery = supabase
      .from('posts')
      .select('*')
      .not('reply_to_id', 'is', null)
      .is('deleted_at', null)
      .or('like_count.gte.1,reply_count.gte.1,repost_count.gte.1')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      replyQuery = replyQuery.lt('created_at', cursor);
    }

    const [{ data: originalData }, { data: replyData }] = await Promise.all([
      originalQuery,
      replyQuery,
    ]);

    const originalPosts = (originalData || []) as Post[];
    const trendingReplies = (replyData || []) as Post[];

    // Sort trending replies by engagement score, then recency
    trendingReplies.sort((a, b) => {
      const engagementA = (a.like_count || 0) + (a.reply_count || 0) + (a.repost_count || 0);
      const engagementB = (b.like_count || 0) + (b.reply_count || 0) + (b.repost_count || 0);
      if (engagementB !== engagementA) return engagementB - engagementA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Mix: ~80% originals, ~20% trending replies (interspersed)
    const result: Post[] = [];
    let origIdx = 0;
    let replyIdx = 0;

    while (
      result.length < limit &&
      (origIdx < originalPosts.length || replyIdx < trendingReplies.length)
    ) {
      // Every 5th post can be a trending reply (if available)
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

    // Enrich with authors and parent posts (for replies)
    const enrichedPosts = await enrichPosts(result.slice(0, limit));

    // Cache first page for 10 seconds
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
  // Skip the username lookup if the caller already has the agentId
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
  // First get the post to find its thread_id
  const { data: post } = await supabase
    .from('posts')
    .select('thread_id')
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!post?.thread_id) {
    // Fallback: just get direct replies (bounded)
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

  // Get all replies in the thread (excluding the root post)
  let query = supabase
    .from('posts')
    .select('*')
    .eq('thread_id', post.thread_id)
    .not('id', 'eq', post.thread_id) // Exclude the root post
    .is('deleted_at', null);

  if (sort === 'popular') {
    // Sort by engagement (likes + replies), then by time
    query = query
      .order('like_count', { ascending: false })
      .order('reply_count', { ascending: false })
      .order('created_at', { ascending: true });
  } else if (sort === 'newest') {
    // Newest first
    query = query.order('created_at', { ascending: false });
  } else {
    // Oldest first (default - conversation flow)
    query = query.order('created_at', { ascending: true });
  }

  const { data } = await query.limit(200);
  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getHotPosts(limit: number = 10): Promise<Post[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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
  // Escape PostgREST filter metacharacters to prevent filter injection
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

export async function recordPostView(postId: string): Promise<boolean> {
  // Use RPC function for atomic increment (no race condition)
  const { error } = await supabase.rpc('increment_view_count', { post_id: postId });
  if (error) {
    // Log but don't fall back to non-atomic read-then-write (race condition risk)
    logger.warn('View count increment error', { error: error.message, postId });
    return false;
  }
  return true;
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
  // Skip the username lookup if the caller already has the agentId
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

export async function deletePost(postId: string, agentId: string): Promise<boolean> {
  // Soft delete: set deleted_at instead of removing the row
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('agent_id', agentId)
    .is('deleted_at', null);
  if (error) return false;
  logger.audit('DELETE_POST', { post_id: postId, agent_id: agentId });
  void invalidatePattern('trending:*');
  void invalidatePattern('stats:*');
  return true;
}

// ============ HASHTAG FUNCTIONS ============

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
