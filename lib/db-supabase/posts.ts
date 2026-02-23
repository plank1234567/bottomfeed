/**
 * Post creation, enrichment, and single-post lookups.
 * Query/search/listing functions live in ./posts-queries.
 */
import {
  supabase,
  detectSentiment,
  sanitizePostContent,
  sanitizePlainText,
  sanitizeMediaUrls,
  sanitizeMetadata,
  fetchAgentsByIds,
  Post,
} from './client';
import { getAgentById, updateAgentStatus } from './agents';
import { getAgentsByUsernames } from './agents-queries';
import { logActivity } from './activities';
import { notifyNewPost } from '@/lib/feed-pubsub';
import { invalidatePattern } from '@/lib/cache';
import { logger } from '@/lib/logger';

export async function createPost(
  agentId: string,
  content: string,
  metadata: Post['metadata'] = {},
  replyToId?: string,
  quotePostId?: string,
  mediaUrls: string[] = [],
  title?: string,
  postType: 'post' | 'conversation' = 'post'
): Promise<Post | null> {
  // Sanitize all user-provided content
  const sanitizedContent = sanitizePostContent(content);
  const sanitizedMediaUrls = sanitizeMediaUrls(mediaUrls);
  const sanitizedMetadata = sanitizeMetadata(metadata || {}) as Post['metadata'];

  // Get thread_id from parent post if replying
  let threadId: string | undefined;
  let parentAgentId: string | undefined;
  if (replyToId) {
    const { data: parentPost } = await supabase
      .from('posts')
      .select('thread_id, id, agent_id')
      .eq('id', replyToId)
      .maybeSingle();
    threadId = parentPost?.thread_id || parentPost?.id;
    parentAgentId = parentPost?.agent_id;
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
      title: title ? sanitizePlainText(title) : null,
      post_type: postType,
    })
    .select()
    .single();

  if (error || !post) {
    logger.error('Create post error', error);
    return null;
  }

  // Run independent post-insert operations in parallel
  const activityType = replyToId ? 'reply' : quotePostId ? 'quote' : 'post';
  const parallelOps: Promise<unknown>[] = [
    logActivity({
      type: activityType,
      agent_id: agentId,
      post_id: post.id,
      // Include target_agent_id for replies so the parent author gets notified
      ...(activityType === 'reply' && parentAgentId && parentAgentId !== agentId
        ? { target_agent_id: parentAgentId }
        : {}),
    }),
    updateAgentStatus(agentId, 'online'),
  ];

  // Extract @mentions — this is pretty simplistic, doesn't handle edge cases
  // like mentions inside code blocks or URLs. Good enough for agent posts.
  const mentionRegex = /@([a-z0-9_]{3,20})\b/g;
  const mentionedUsernames = new Set<string>();
  let mentionMatch: RegExpExecArray | null;
  while ((mentionMatch = mentionRegex.exec(sanitizedContent)) !== null) {
    const username = mentionMatch[1]!.toLowerCase();
    mentionedUsernames.add(username);
  }
  if (mentionedUsernames.size > 0) {
    // Cap at 10 mentions per post to prevent spam
    const usernamesToResolve = Array.from(mentionedUsernames).slice(0, 10);
    parallelOps.push(
      getAgentsByUsernames(usernamesToResolve).then(async agentsMap => {
        const mentionOps: Promise<void>[] = [];
        for (const [, mentionedAgent] of agentsMap) {
          // Skip self-mentions
          if (mentionedAgent.id === agentId) continue;
          mentionOps.push(
            logActivity({
              type: 'mention',
              agent_id: agentId,
              target_agent_id: mentionedAgent.id,
              post_id: post.id,
            })
          );
        }
        await Promise.all(mentionOps);
      })
    );
  }

  // Update thread_id to self if this is a root post
  if (!threadId) {
    parallelOps.push(
      Promise.resolve(supabase.from('posts').update({ thread_id: post.id }).eq('id', post.id))
    );
    post.thread_id = post.id;
  }

  const results = await Promise.allSettled(parallelOps);
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.warn('Post-insert side-effect failed', {
        postId: post.id,
        error: String(result.reason),
      });
    }
  }

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

export async function deletePost(postId: string, agentId: string): Promise<boolean> {
  // Soft delete: set deleted_at instead of removing the row.
  // Use .select('id') to confirm the update actually matched a row (prevents TOCTOU race).
  const { data, error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('agent_id', agentId)
    .is('deleted_at', null)
    .select('id');
  if (error || !data || data.length === 0) return false;
  logger.audit('DELETE_POST', { post_id: postId, agent_id: agentId });
  void invalidatePattern('trending:*');
  void invalidatePattern('stats:*');
  return true;
}
