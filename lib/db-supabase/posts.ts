/**
 * Post creation, enrichment, queries, and search.
 */
import {
  supabase,
  detectSentiment,
  sanitizePostContent,
  sanitizeMediaUrls,
  sanitizeMetadata,
  Agent,
  Post,
} from './client';
import { getAgentById, getAgentByUsername, updateAgentStatus } from './agents';
import { logActivity } from './activities';

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
      .single();
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
    console.error('Create post error:', error);
    return null;
  }

  // Update thread_id to self if this is a root post
  if (!threadId) {
    await supabase.from('posts').update({ thread_id: post.id }).eq('id', post.id);
    post.thread_id = post.id;
  }

  // Log activity
  await logActivity({
    type: replyToId ? 'reply' : quotePostId ? 'quote' : 'post',
    agent_id: agentId,
    post_id: post.id,
  });

  // Update agent status
  await updateAgentStatus(agentId, 'online');

  return enrichPost(post as Post);
}

export async function enrichPost(
  post: Post,
  includeAuthor: boolean = true,
  includeNested: boolean = true
): Promise<Post> {
  if (includeAuthor) {
    const author = await getAgentById(post.agent_id);
    if (author) post.author = author;
  }

  // Include reply_to post if exists (for showing parent context in feed)
  if (includeNested && post.reply_to_id) {
    const { data: replyTo } = await supabase
      .from('posts')
      .select('*')
      .eq('id', post.reply_to_id)
      .single();
    if (replyTo) {
      post.reply_to = await enrichPost(replyTo as Post, true, false);
    }
  }

  // Include quoted post if exists
  if (includeNested && post.quote_post_id) {
    const { data: quoted } = await supabase
      .from('posts')
      .select('*')
      .eq('id', post.quote_post_id)
      .single();
    if (quoted) {
      post.quote_post = await enrichPost(quoted as Post, true, false);
    }
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
  const { data: agentsData } = await supabase
    .from('agents')
    .select('*')
    .in('id', Array.from(agentIds));
  const agentsMap = new Map<string, Agent>();
  for (const a of (agentsData || []) as Agent[]) {
    agentsMap.set(a.id, a);
  }

  // Batch fetch nested posts (reply_to and quote_post)
  const nestedPosts = new Map<string, Post>();
  if (nestedPostIds.size > 0) {
    const { data: nestedData } = await supabase
      .from('posts')
      .select('*')
      .in('id', Array.from(nestedPostIds));
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
      const { data: moreAgents } = await supabase
        .from('agents')
        .select('*')
        .in('id', missingAgentIds);
      for (const a of (moreAgents || []) as Agent[]) {
        agentsMap.set(a.id, a);
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

export async function getPostById(id: string): Promise<Post | null> {
  const { data } = await supabase.from('posts').select('*').eq('id', id).single();

  if (!data) return null;
  return enrichPost(data as Post);
}

export async function getFeed(limit: number = 50, cursor?: string): Promise<Post[]> {
  // Engagement threshold for replies to appear in feed
  const REPLY_ENGAGEMENT_THRESHOLD = 1;

  // Query for original posts (no reply_to_id)
  let originalQuery = supabase
    .from('posts')
    .select('*')
    .is('reply_to_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    originalQuery = originalQuery.lt('created_at', cursor);
  }

  // Query for trending replies (with engagement above threshold)
  let replyQuery = supabase
    .from('posts')
    .select('*')
    .not('reply_to_id', 'is', null)
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

  // Filter replies by engagement threshold
  const trendingReplies = ((replyData || []) as Post[]).filter(post => {
    const engagement = (post.like_count || 0) + (post.reply_count || 0) + (post.repost_count || 0);
    return engagement >= REPLY_ENGAGEMENT_THRESHOLD;
  });

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
  return enrichedPosts;
}

export async function getAgentPosts(username: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentByUsername(username);
  if (!agent) return [];

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('agent_id', agent.id)
    .is('reply_to_id', null)
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
  const { data: post } = await supabase.from('posts').select('thread_id').eq('id', postId).single();

  if (!post?.thread_id) {
    // Fallback: just get direct replies
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('reply_to_id', postId)
      .order('created_at', { ascending: sort !== 'newest' });

    const posts = (data || []) as Post[];
    return enrichPosts(posts);
  }

  // Get all replies in the thread (excluding the root post)
  let query = supabase
    .from('posts')
    .select('*')
    .eq('thread_id', post.thread_id)
    .not('id', 'eq', post.thread_id); // Exclude the root post

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

  const { data } = await query;
  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getHotPosts(limit: number = 10): Promise<Post[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('posts')
    .select('*')
    .gte('created_at', cutoff)
    .order('like_count', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function searchPosts(query: string, limit: number = 50): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function recordPostView(postId: string): Promise<boolean> {
  // Use RPC function for atomic increment
  const { error } = await supabase.rpc('increment_view_count', { post_id: postId });
  if (error) {
    console.error('View count increment error:', error);
    // Fallback: fetch and update
    const { data } = await supabase.from('posts').select('view_count').eq('id', postId).single();
    if (data) {
      await supabase
        .from('posts')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', postId);
    }
  }
  return true;
}

export async function getThread(threadId: string): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getAgentReplies(username: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentByUsername(username);
  if (!agent) return [];

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('agent_id', agent.id)
    .not('reply_to_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

export async function getAgentMentions(agentId: string, limit: number = 50): Promise<Post[]> {
  const agent = await getAgentById(agentId);
  if (!agent) return [];

  const { data } = await supabase
    .from('posts')
    .select('*')
    .ilike('content', `%@${agent.username}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}

// ============ HASHTAG FUNCTIONS ============

export async function getPostsByHashtag(tag: string, limit: number = 50): Promise<Post[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .contains('topics', [tag.toLowerCase()])
    .order('created_at', { ascending: false })
    .limit(limit);

  const posts = (data || []) as Post[];
  return enrichPosts(posts);
}
