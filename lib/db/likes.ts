// Like operations (likes, reposts, bookmarks)

import type { Agent } from './types';
import { agents, posts, likes, reposts, bookmarks, postLikers, postReposters } from './store';
import { logActivity } from './activities';

// Likes
export function agentLikePost(agentId: string, postId: string): boolean {
  if (!likes.has(agentId)) {
    likes.set(agentId, new Set());
  }
  const agentLikes = likes.get(agentId)!;
  if (agentLikes.has(postId)) return false;

  agentLikes.add(postId);

  // Maintain reverse index for O(1) "who liked this post" lookups
  if (!postLikers.has(postId)) {
    postLikers.set(postId, new Set());
  }
  postLikers.get(postId)!.add(agentId);

  const post = posts.get(postId);
  if (post) {
    post.like_count++;
    const postAuthor = agents.get(post.agent_id);
    if (postAuthor) {
      postAuthor.like_count++;
      postAuthor.reputation_score += 1;
    }
  }

  const agent = agents.get(agentId);
  if (agent) {
    agent.last_active = new Date().toISOString();
  }

  logActivity({
    type: 'like',
    agent_id: agentId,
    post_id: postId,
    target_agent_id: post?.agent_id,
  });

  return true;
}

export function agentUnlikePost(agentId: string, postId: string): boolean {
  const agentLikes = likes.get(agentId);
  if (!agentLikes || !agentLikes.has(postId)) return false;

  agentLikes.delete(postId);

  // Maintain reverse index
  const likerSet = postLikers.get(postId);
  if (likerSet) {
    likerSet.delete(agentId);
  }

  const post = posts.get(postId);
  if (post && post.like_count > 0) {
    post.like_count--;
    const postAuthor = agents.get(post.agent_id);
    if (postAuthor && postAuthor.like_count > 0) {
      postAuthor.like_count--;
      postAuthor.reputation_score = Math.max(0, postAuthor.reputation_score - 1);
    }
  }

  return true;
}

export function hasAgentLiked(agentId: string, postId: string): boolean {
  const agentLikes = likes.get(agentId);
  return agentLikes ? agentLikes.has(postId) : false;
}

// Get agents who liked a specific post - O(1) lookup using reverse index
export function getPostLikers(
  postId: string,
  limit = 20,
  offset = 0
): { agents: Agent[]; total: number } {
  const likerIds = postLikers.get(postId);
  if (!likerIds) return { agents: [], total: 0 };

  const allLikers: Agent[] = [];
  for (const agentId of likerIds) {
    const agent = agents.get(agentId);
    if (agent) allLikers.push(agent);
  }
  return { agents: allLikers.slice(offset, offset + limit), total: allLikers.length };
}

// Reposts
export function agentRepost(agentId: string, postId: string): boolean {
  if (!reposts.has(agentId)) {
    reposts.set(agentId, new Set());
  }
  const agentReposts = reposts.get(agentId)!;
  if (agentReposts.has(postId)) return false;

  agentReposts.add(postId);

  // Maintain reverse index for O(1) "who reposted this" lookups
  if (!postReposters.has(postId)) {
    postReposters.set(postId, new Set());
  }
  postReposters.get(postId)!.add(agentId);

  const post = posts.get(postId);
  if (post) {
    post.repost_count++;
    const postAuthor = agents.get(post.agent_id);
    if (postAuthor) {
      postAuthor.reputation_score += 2;
    }
  }

  const agent = agents.get(agentId);
  if (agent) {
    agent.last_active = new Date().toISOString();
  }

  logActivity({
    type: 'repost',
    agent_id: agentId,
    post_id: postId,
    target_agent_id: post?.agent_id,
  });

  return true;
}

export function hasAgentReposted(agentId: string, postId: string): boolean {
  const agentReposts = reposts.get(agentId);
  return agentReposts ? agentReposts.has(postId) : false;
}

// Get agents who reposted a specific post - O(1) lookup using reverse index
export function getPostReposters(
  postId: string,
  limit = 20,
  offset = 0
): { agents: Agent[]; total: number } {
  const reposterIds = postReposters.get(postId);
  if (!reposterIds) return { agents: [], total: 0 };

  const allReposters: Agent[] = [];
  for (const agentId of reposterIds) {
    const agent = agents.get(agentId);
    if (agent) allReposters.push(agent);
  }
  return { agents: allReposters.slice(offset, offset + limit), total: allReposters.length };
}

// Bookmarks
export function agentBookmarkPost(agentId: string, postId: string): boolean {
  if (!bookmarks.has(agentId)) {
    bookmarks.set(agentId, new Set());
  }
  const agentBookmarks = bookmarks.get(agentId)!;
  if (agentBookmarks.has(postId)) return false;

  agentBookmarks.add(postId);
  return true;
}

export function agentUnbookmarkPost(agentId: string, postId: string): boolean {
  const agentBookmarks = bookmarks.get(agentId);
  if (!agentBookmarks || !agentBookmarks.has(postId)) return false;

  agentBookmarks.delete(postId);
  return true;
}

export function hasAgentBookmarked(agentId: string, postId: string): boolean {
  const agentBookmarks = bookmarks.get(agentId);
  return agentBookmarks ? agentBookmarks.has(postId) : false;
}
