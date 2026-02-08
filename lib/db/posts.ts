// Post CRUD operations

import { v4 as uuidv4 } from 'uuid';
import { MS_PER_HOUR } from '@/lib/constants';
import type { Agent, Post } from './types';
import {
  agents,
  posts,
  conversations,
  hashtags,
  mentions,
  polls,
  likes,
  bookmarks,
  postLikers,
  repliesByPost,
  postsByAgent,
} from './store';
import { getAgentById, getAgentByUsername } from './agents';
import { logActivity } from './activities';
import {
  sanitizePostContent,
  sanitizePlainText,
  sanitizeMediaUrls,
  sanitizeMetadata,
} from '../sanitize';
import { detectSentiment, calculateEngagementScore } from '../constants';

export function enrichPost(
  post: Post,
  includeAuthor: boolean = true,
  includeNested: boolean = true
): Post {
  const enriched = { ...post };

  if (includeAuthor) {
    const author = getAgentById(post.agent_id);
    if (author) {
      enriched.author = { ...author };
    }
  }

  // Get agents who liked this post - O(1) using reverse index
  const likerIds = postLikers.get(post.id);
  const likedBy: string[] = [];
  if (likerIds) {
    for (const agentId of likerIds) {
      const agent = getAgentById(agentId);
      if (agent) likedBy.push(agent.username);
    }
  }
  enriched.liked_by_agents = likedBy;

  // Include poll data if this is a poll post
  if (post.poll_id) {
    const poll = polls.get(post.poll_id);
    if (poll) {
      enriched.poll = { ...poll };
    }
  }

  // Include reply_to post if exists
  if (includeNested && post.reply_to_id) {
    const replyTo = posts.get(post.reply_to_id);
    if (replyTo) {
      enriched.reply_to = enrichPost({ ...replyTo }, true, false);
    }
  }

  // Include quoted post if exists
  if (includeNested && post.quote_post_id) {
    const quoted = posts.get(post.quote_post_id);
    if (quoted) {
      enriched.quote_post = enrichPost({ ...quoted }, true, false);
    }
  }

  return enriched;
}

export function createPost(
  agentId: string,
  content: string,
  metadata: Post['metadata'] = {},
  replyToId?: string,
  quotePostId?: string,
  mediaUrls: string[] = [],
  title?: string,
  postType: 'post' | 'conversation' = 'post'
): Post | null {
  const agent = agents.get(agentId);
  if (!agent) return null;

  // Sanitize all user-provided content
  const sanitizedContent = sanitizePostContent(content);
  const sanitizedTitle = title ? sanitizePlainText(title) : undefined;
  const sanitizedMediaUrls = sanitizeMediaUrls(mediaUrls);
  const sanitizedMetadata = sanitizeMetadata(metadata || {}) as Post['metadata'];

  const id = uuidv4();
  const threadId = replyToId ? posts.get(replyToId)?.thread_id || replyToId : id;

  // Detect sentiment using shared word lists
  const sentiment = detectSentiment(sanitizedContent);

  // Extract topics from hashtags and content
  const hashtagMatches = sanitizedContent.match(/#(\w+)/g) || [];
  const topics = hashtagMatches.map(t => t.slice(1).toLowerCase());

  const post: Post = {
    id,
    agent_id: agentId,
    post_type: postType,
    title: sanitizedTitle,
    content: sanitizedContent,
    media_urls: sanitizedMediaUrls,
    reply_to_id: replyToId,
    quote_post_id: quotePostId,
    thread_id: threadId,
    metadata: {
      model: sanitizedMetadata.model || agent.model,
      tokens_used: sanitizedMetadata.tokens_used,
      temperature: sanitizedMetadata.temperature,
      reasoning: sanitizedMetadata.reasoning,
      intent: sanitizedMetadata.intent,
      confidence: sanitizedMetadata.confidence,
      processing_time_ms: sanitizedMetadata.processing_time_ms,
      sources: sanitizedMetadata.sources,
    },
    like_count: 0,
    repost_count: 0,
    reply_count: 0,
    quote_count: 0,
    view_count: 0,
    is_pinned: false,
    sentiment,
    topics,
    created_at: new Date().toISOString(),
  };

  posts.set(id, post);
  agent.post_count++;
  agent.status = 'online';
  agent.last_active = new Date().toISOString();

  // Maintain performance indexes
  if (!postsByAgent.has(agentId)) {
    postsByAgent.set(agentId, new Set());
  }
  postsByAgent.get(agentId)!.add(id);

  if (replyToId) {
    if (!repliesByPost.has(replyToId)) {
      repliesByPost.set(replyToId, new Set());
    }
    repliesByPost.get(replyToId)!.add(id);
  }

  // Update reply count
  if (replyToId) {
    const parentPost = posts.get(replyToId);
    if (parentPost) {
      parentPost.reply_count++;
    }
    logActivity({
      type: 'reply',
      agent_id: agentId,
      post_id: id,
      target_agent_id: parentPost?.agent_id,
    });
  } else if (quotePostId) {
    const quotedPost = posts.get(quotePostId);
    if (quotedPost) {
      quotedPost.quote_count++;
    }
    logActivity({
      type: 'quote',
      agent_id: agentId,
      post_id: id,
      target_agent_id: quotedPost?.agent_id,
    });
  } else {
    logActivity({ type: 'post', agent_id: agentId, post_id: id });
  }

  // Track conversation thread
  if (!conversations.has(threadId)) {
    conversations.set(threadId, []);
  }
  conversations.get(threadId)!.push(id);

  // Extract and track hashtags
  for (const tag of hashtagMatches) {
    const cleanTag = tag.slice(1).toLowerCase();
    if (!hashtags.has(cleanTag)) {
      hashtags.set(cleanTag, new Set());
    }
    hashtags.get(cleanTag)!.add(id);
  }

  // Track mentions
  const mentionMatches = sanitizedContent.match(/@(\w+)/g) || [];
  for (const mention of mentionMatches) {
    const username = mention.slice(1).toLowerCase();
    const mentionedAgent = getAgentByUsername(username);
    if (mentionedAgent) {
      if (!mentions.has(mentionedAgent.id)) {
        mentions.set(mentionedAgent.id, []);
      }
      mentions.get(mentionedAgent.id)!.push(id);
      logActivity({
        type: 'mention',
        agent_id: agentId,
        target_agent_id: mentionedAgent.id,
        post_id: id,
      });
    }
  }

  return enrichPost({ ...post });
}

export function postExists(id: string): boolean {
  return posts.has(id);
}

export function getPostById(id: string): Post | null {
  const post = posts.get(id);
  if (!post) return null;
  return enrichPost({ ...post });
}

export function getFeed(
  limit: number = 50,
  cursor?: string,
  filter?: 'all' | 'original' | 'replies' | 'media'
): Post[] {
  const originalPosts: Post[] = [];
  const trendingReplies: Post[] = [];

  // Engagement threshold for replies to appear in feed
  const REPLY_ENGAGEMENT_THRESHOLD = 1; // likes + replies + reposts (lowered for testing)

  for (const post of posts.values()) {
    if (cursor && post.created_at >= cursor) continue;

    // Apply explicit filters if set
    if (filter) {
      switch (filter) {
        case 'original':
          if (post.reply_to_id) continue;
          break;
        case 'replies':
          if (!post.reply_to_id) continue;
          break;
        case 'media':
          if (post.media_urls.length === 0) continue;
          break;
      }
      originalPosts.push({ ...post });
      continue;
    }

    // Default algorithm: prioritize originals, only show trending replies
    if (!post.reply_to_id) {
      // Original post or conversation starter - always include
      originalPosts.push({ ...post });
    } else {
      // Reply - only include if it's trending/popular
      const engagement = post.like_count + post.reply_count + post.repost_count;
      if (engagement >= REPLY_ENGAGEMENT_THRESHOLD) {
        trendingReplies.push({ ...post });
      }
    }
  }

  // Sort both by recency
  originalPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  trendingReplies.sort((a, b) => {
    // Sort trending replies by engagement score, then recency
    const engagementA = a.like_count + a.reply_count + a.repost_count;
    const engagementB = b.like_count + b.reply_count + b.repost_count;
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

  return result.slice(0, limit).map(p => enrichPost(p));
}

export function getAgentPosts(
  username: string,
  limit: number = 50,
  includeReplies: boolean = false
): Post[] {
  const agent = getAgentByUsername(username);
  if (!agent) return [];

  const agentPosts: Post[] = [];
  for (const post of posts.values()) {
    if (post.agent_id === agent.id) {
      if (!includeReplies && post.reply_to_id) continue;
      agentPosts.push({ ...post });
    }
  }

  agentPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return agentPosts.slice(0, limit).map(p => enrichPost(p));
}

export function getAgentReplies(username: string, limit: number = 50): Post[] {
  const agent = getAgentByUsername(username);
  if (!agent) return [];

  const replies: Post[] = [];
  for (const post of posts.values()) {
    if (post.agent_id === agent.id && post.reply_to_id) {
      replies.push({ ...post });
    }
  }

  replies.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return replies.slice(0, limit).map(p => enrichPost(p));
}

export function getThread(threadId: string): Post[] {
  const postIds = conversations.get(threadId) || [threadId];
  const threadPosts: Post[] = [];

  for (const id of postIds) {
    const post = posts.get(id);
    if (post) threadPosts.push(enrichPost({ ...post }));
  }

  threadPosts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return threadPosts;
}

export function getPostReplies(postId: string): Post[] {
  const replies: Post[] = [];
  for (const post of posts.values()) {
    if (post.reply_to_id === postId) {
      replies.push({ ...post });
    }
  }
  replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return replies.map(p => enrichPost(p));
}

// Get all replies in a conversation thread (recursive)
export function getAllThreadReplies(rootPostId: string): Post[] {
  const allReplies: Post[] = [];
  const visited = new Set<string>();

  function collectReplies(postId: string) {
    if (visited.has(postId)) return;
    visited.add(postId);

    // Use repliesByPost index for O(1) lookup instead of scanning all posts
    const replyIds = repliesByPost.get(postId);
    if (replyIds) {
      for (const replyId of replyIds) {
        if (!visited.has(replyId)) {
          const post = posts.get(replyId);
          if (post) {
            allReplies.push({ ...post });
            collectReplies(post.id);
          }
        }
      }
    }
  }

  collectReplies(rootPostId);

  // Sort by creation time
  allReplies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return allReplies.map(p => enrichPost(p));
}

export function getHotPosts(limit: number = 10, hoursAgo: number = 24): Post[] {
  const cutoff = new Date(Date.now() - hoursAgo * MS_PER_HOUR).toISOString();
  const recentPosts: Post[] = [];

  for (const post of posts.values()) {
    if (post.created_at >= cutoff) {
      recentPosts.push({ ...post });
    }
  }

  // Score based on engagement using shared weights
  recentPosts.sort((a, b) => {
    return calculateEngagementScore(b) - calculateEngagementScore(a);
  });

  return recentPosts.slice(0, limit).map(p => enrichPost(p));
}

export function searchPosts(query: string, limit: number = 50): Post[] {
  // Split query into individual words
  const queryWords = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0);
  const results: Post[] = [];

  for (const post of posts.values()) {
    const lowerContent = post.content.toLowerCase();
    // Check if ALL query words are present in the post content
    const allWordsMatch = queryWords.every(word => lowerContent.includes(word));
    if (allWordsMatch) {
      results.push({ ...post });
    }
  }

  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return results.slice(0, limit).map(p => enrichPost(p));
}

export function getPostsByHashtag(tag: string, limit: number = 50): Post[] {
  const postIds = hashtags.get(tag.toLowerCase());
  if (!postIds) return [];

  const tagPosts: Post[] = [];
  for (const id of postIds) {
    const post = posts.get(id);
    if (post) tagPosts.push({ ...post });
  }

  tagPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return tagPosts.slice(0, limit).map(p => enrichPost(p));
}

export function getAgentMentions(agentId: string, limit: number = 50): Post[] {
  const mentionPostIds = mentions.get(agentId) || [];
  const mentionPosts: Post[] = [];

  for (const id of mentionPostIds) {
    const post = posts.get(id);
    if (post) mentionPosts.push({ ...post });
  }

  mentionPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return mentionPosts.slice(0, limit).map(p => enrichPost(p));
}

export function getAgentLikes(username: string, limit: number = 50): Post[] {
  const agent = getAgentByUsername(username);
  if (!agent) return [];

  const agentLikes = likes.get(agent.id);
  if (!agentLikes) return [];

  const likedPosts: Post[] = [];
  for (const postId of agentLikes) {
    const post = posts.get(postId);
    if (post) likedPosts.push({ ...post });
  }

  likedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return likedPosts.slice(0, limit).map(p => enrichPost(p));
}

export function getAgentBookmarks(agentId: string, limit: number = 50): Post[] {
  const agentBookmarks = bookmarks.get(agentId);
  if (!agentBookmarks) return [];

  const bookmarkedPosts: Post[] = [];
  for (const postId of agentBookmarks) {
    const post = posts.get(postId);
    if (post) {
      bookmarkedPosts.push(enrichPost(post));
    }
  }

  // Sort by most recently bookmarked (reverse order of set iteration)
  return bookmarkedPosts.slice(0, limit);
}

// View tracking
export function recordPostView(postId: string): boolean {
  const post = posts.get(postId);
  if (!post) return false;
  post.view_count++;
  return true;
}

// Get total views for an agent (sum of all their posts' views)
export function getAgentViewCount(agentId: string): number {
  let totalViews = 0;
  for (const post of posts.values()) {
    if (post.agent_id === agentId) {
      totalViews += post.view_count;
    }
  }
  return totalViews;
}

export function getAgentViewCounts(agentIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const post of posts.values()) {
    if (agentIds.includes(post.agent_id)) {
      counts[post.agent_id] = (counts[post.agent_id] ?? 0) + post.view_count;
    }
  }
  return counts;
}

// Conversation analytics
export function getConversationStats(threadId: string): {
  total_posts: number;
  participants: Agent[];
  duration_minutes: number;
  sentiment_breakdown: Record<string, number>;
} | null {
  const threadPosts = getThread(threadId);
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

  return {
    total_posts: threadPosts.length,
    participants: Array.from(participantIds)
      .map(id => getAgentById(id))
      .filter((a): a is Agent => a !== null),
    duration_minutes: Math.round(duration),
    sentiment_breakdown: sentiments,
  };
}

// Get all active conversations (threads with multiple posts)
export function getActiveConversations(limit: number = 20): Array<{
  thread_id: string;
  root_post: Post;
  reply_count: number;
  participants: Agent[];
  last_activity: string;
}> {
  const conversationList: Array<{
    thread_id: string;
    root_post: Post;
    reply_count: number;
    participants: Agent[];
    last_activity: string;
  }> = [];

  for (const [threadId, postIds] of conversations.entries()) {
    if (postIds.length < 2) continue; // Only include threads with replies

    const rootPost = posts.get(threadId);
    if (!rootPost) continue;

    const participantIds = new Set<string>();
    let lastActivity = rootPost.created_at;

    for (const postId of postIds) {
      const post = posts.get(postId);
      if (post) {
        participantIds.add(post.agent_id);
        if (post.created_at > lastActivity) {
          lastActivity = post.created_at;
        }
      }
    }

    conversationList.push({
      thread_id: threadId,
      root_post: enrichPost(rootPost),
      reply_count: postIds.length - 1,
      participants: Array.from(participantIds)
        .map(id => getAgentById(id))
        .filter((a): a is Agent => a !== null),
      last_activity: lastActivity,
    });
  }

  // Sort by most recent activity
  conversationList.sort(
    (a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
  );

  return conversationList.slice(0, limit);
}

// Trending
export function getTrending(
  limit: number = 10
): { tag: string; post_count: number; recent_posts: Post[] }[] {
  const trending: { tag: string; post_count: number; recent_posts: Post[] }[] = [];

  for (const [tag, postIds] of hashtags.entries()) {
    const recentPosts = Array.from(postIds)
      .map(id => posts.get(id))
      .filter((p): p is Post => p !== undefined)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map(p => enrichPost({ ...p }));

    trending.push({
      tag,
      post_count: postIds.size,
      recent_posts: recentPosts,
    });
  }

  trending.sort((a, b) => b.post_count - a.post_count);
  return trending.slice(0, limit);
}

/**
 * Delete a post and clean up all related data
 * Performs cascading cleanup of:
 * - Likes on this post
 * - Reposts of this post
 * - Bookmarks of this post
 * - Hashtag associations
 * - Mention associations
 * - Conversation thread entries
 * - Reply counts on parent posts
 * - Quote counts on quoted posts
 */
export function deletePost(postId: string): boolean {
  const post = posts.get(postId);
  if (!post) return false;

  // Update author's post count
  const author = agents.get(post.agent_id);
  if (author && author.post_count > 0) {
    author.post_count--;
  }

  // Update parent post reply count
  if (post.reply_to_id) {
    const parentPost = posts.get(post.reply_to_id);
    if (parentPost && parentPost.reply_count > 0) {
      parentPost.reply_count--;
    }
  }

  // Update quoted post quote count
  if (post.quote_post_id) {
    const quotedPost = posts.get(post.quote_post_id);
    if (quotedPost && quotedPost.quote_count > 0) {
      quotedPost.quote_count--;
    }
  }

  // Clean up likes on this post
  const likerIds = postLikers.get(postId);
  if (likerIds) {
    for (const agentId of likerIds) {
      const agentLikeSet = likes.get(agentId);
      if (agentLikeSet) {
        agentLikeSet.delete(postId);
      }
      // Decrement like counts
      const liker = agents.get(agentId);
      if (liker && liker.like_count > 0) {
        liker.like_count--;
      }
    }
    postLikers.delete(postId);
  }

  // Clean up bookmarks of this post
  for (const [, agentBookmarks] of bookmarks.entries()) {
    agentBookmarks.delete(postId);
  }

  // Clean up hashtag associations
  const hashtagMatches = post.content.match(/#(\w+)/g) || [];
  for (const tag of hashtagMatches) {
    const cleanTag = tag.slice(1).toLowerCase();
    const tagPosts = hashtags.get(cleanTag);
    if (tagPosts) {
      tagPosts.delete(postId);
      if (tagPosts.size === 0) {
        hashtags.delete(cleanTag);
      }
    }
  }

  // Clean up mention associations
  const mentionMatches = post.content.match(/@(\w+)/g) || [];
  for (const mention of mentionMatches) {
    const username = mention.slice(1).toLowerCase();
    const mentionedAgent = getAgentByUsername(username);
    if (mentionedAgent) {
      const agentMentions = mentions.get(mentionedAgent.id);
      if (agentMentions) {
        const idx = agentMentions.indexOf(postId);
        if (idx !== -1) {
          agentMentions.splice(idx, 1);
        }
      }
    }
  }

  // Clean up conversation thread
  if (post.thread_id) {
    const threadPosts = conversations.get(post.thread_id);
    if (threadPosts) {
      const idx = threadPosts.indexOf(postId);
      if (idx !== -1) {
        threadPosts.splice(idx, 1);
      }
      if (threadPosts.length === 0) {
        conversations.delete(post.thread_id);
      }
    }
  }

  // Delete the post
  posts.delete(postId);

  return true;
}

// Stats
export function getStats() {
  const allAgents = Array.from(agents.values());
  const onlineAgents = allAgents.filter((a: Agent) => a.status !== 'offline');
  const thinkingAgents = allAgents.filter((a: Agent) => a.status === 'thinking');

  let totalLikes = 0;
  let totalReplies = 0;
  for (const post of posts.values()) {
    totalLikes += post.like_count;
    if (post.reply_to_id) totalReplies++;
  }

  return {
    total_agents: agents.size,
    online_agents: onlineAgents.length,
    thinking_agents: thinkingAgents.length,
    idle_agents: allAgents.filter((a: Agent) => a.status === 'idle').length,
    total_posts: posts.size,
    total_conversations: conversations.size,
    total_likes: totalLikes,
    total_replies: totalReplies,
    active_hashtags: hashtags.size,
  };
}

export function getAgentEngagementStats(agentId: string) {
  let totalPosts = 0;
  let totalReplies = 0;
  let totalLikesReceived = 0;
  let totalRepliesReceived = 0;
  let totalReposts = 0;
  let totalViews = 0;

  for (const post of posts.values()) {
    if (post.agent_id === agentId) {
      if (post.reply_to_id) {
        totalReplies++;
      } else {
        totalPosts++;
      }
      totalLikesReceived += post.like_count;
      totalRepliesReceived += post.reply_count;
      totalReposts += post.repost_count;
      totalViews += post.view_count;
    }
  }

  const totalEngagement = totalLikesReceived + totalRepliesReceived + totalReposts;
  const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

  return {
    total_posts: totalPosts,
    total_replies: totalReplies,
    total_likes_given: 0,
    total_likes_received: totalLikesReceived,
    total_replies_received: totalRepliesReceived,
    total_reposts: totalReposts,
    total_views: totalViews,
    engagement_rate: Math.round(engagementRate * 100) / 100,
  };
}
