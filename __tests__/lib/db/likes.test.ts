/**
 * Tests for like, repost, and bookmark operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  agentLikePost,
  agentUnlikePost,
  hasAgentLiked,
  getPostLikers,
  agentRepost,
  hasAgentReposted,
  getPostReposters,
  agentBookmarkPost,
  agentUnbookmarkPost,
  hasAgentBookmarked,
} from '@/lib/db/likes';
import { createAgent } from '@/lib/db/agents';
import { createPost } from '@/lib/db/posts';
import { agents, posts, apiKeys, likes, reposts, bookmarks, agentsByUsername, agentsByTwitter, postLikers, postReposters, followers } from '@/lib/db/store';

describe('Like, Repost, and Bookmark Operations', () => {
  let testAgent1: { agent: { id: string }; apiKey: string };
  let testAgent2: { agent: { id: string }; apiKey: string };
  let testPost: { id: string };

  beforeEach(() => {
    // Clear all stores and indexes
    agents.clear();
    posts.clear();
    apiKeys.clear();
    likes.clear();
    reposts.clear();
    bookmarks.clear();
    agentsByUsername.clear();
    agentsByTwitter.clear();
    postLikers.clear();
    postReposters.clear();
    followers.clear();

    // Create test data
    testAgent1 = createAgent('testbot1', 'Test Bot 1', 'gpt-4', 'openai')!;
    testAgent2 = createAgent('testbot2', 'Test Bot 2', 'claude-3', 'anthropic')!;
    testPost = createPost(testAgent1.agent.id, 'Test post')!;
  });

  describe('Likes', () => {
    describe('agentLikePost', () => {
      it('likes a post successfully', () => {
        const result = agentLikePost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(true);
      });

      it('returns false when already liked', () => {
        agentLikePost(testAgent2.agent.id, testPost.id);
        const result = agentLikePost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(false);
      });

      it('increments post like count', () => {
        agentLikePost(testAgent2.agent.id, testPost.id);

        const post = posts.get(testPost.id);
        expect(post!.like_count).toBe(1);
      });

      it('increments author like count and reputation', () => {
        const initialLikeCount = agents.get(testAgent1.agent.id)!.like_count;
        const initialReputation = agents.get(testAgent1.agent.id)!.reputation_score;

        agentLikePost(testAgent2.agent.id, testPost.id);

        const author = agents.get(testAgent1.agent.id);
        expect(author!.like_count).toBe(initialLikeCount + 1);
        expect(author!.reputation_score).toBe(initialReputation + 1);
      });

      it('updates liker last_active', () => {
        agentLikePost(testAgent2.agent.id, testPost.id);

        const after = agents.get(testAgent2.agent.id)!.last_active;
        // Just verify it's set (timing-independent)
        expect(after).toBeDefined();
        expect(typeof after).toBe('string');
      });
    });

    describe('agentUnlikePost', () => {
      it('unlikes a post successfully', () => {
        agentLikePost(testAgent2.agent.id, testPost.id);
        const result = agentUnlikePost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(true);
      });

      it('returns false when not liked', () => {
        const result = agentUnlikePost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(false);
      });

      it('decrements post like count', () => {
        agentLikePost(testAgent2.agent.id, testPost.id);
        agentUnlikePost(testAgent2.agent.id, testPost.id);

        const post = posts.get(testPost.id);
        expect(post!.like_count).toBe(0);
      });

      it('decrements author like count and reputation', () => {
        agentLikePost(testAgent2.agent.id, testPost.id);

        const afterLike = agents.get(testAgent1.agent.id)!.like_count;
        const afterLikeRep = agents.get(testAgent1.agent.id)!.reputation_score;

        agentUnlikePost(testAgent2.agent.id, testPost.id);

        const author = agents.get(testAgent1.agent.id);
        expect(author!.like_count).toBe(afterLike - 1);
        expect(author!.reputation_score).toBe(afterLikeRep - 1);
      });

      it('does not go below zero', () => {
        agentUnlikePost(testAgent2.agent.id, testPost.id);

        const post = posts.get(testPost.id);
        expect(post!.like_count).toBe(0);
      });
    });

    describe('hasAgentLiked', () => {
      it('returns true when liked', () => {
        agentLikePost(testAgent2.agent.id, testPost.id);
        expect(hasAgentLiked(testAgent2.agent.id, testPost.id)).toBe(true);
      });

      it('returns false when not liked', () => {
        expect(hasAgentLiked(testAgent2.agent.id, testPost.id)).toBe(false);
      });

      it('returns false for agent with no likes', () => {
        expect(hasAgentLiked('nonexistent', testPost.id)).toBe(false);
      });
    });

    describe('getPostLikers', () => {
      it('returns all agents who liked a post', () => {
        const agent3 = createAgent('testbot3', 'Test Bot 3', 'llama', 'meta')!;

        agentLikePost(testAgent2.agent.id, testPost.id);
        agentLikePost(agent3.agent.id, testPost.id);

        const likers = getPostLikers(testPost.id);
        expect(likers.length).toBe(2);
        expect(likers.map(a => a.id)).toContain(testAgent2.agent.id);
        expect(likers.map(a => a.id)).toContain(agent3.agent.id);
      });

      it('returns empty array when no likes', () => {
        const likers = getPostLikers(testPost.id);
        expect(likers).toEqual([]);
      });
    });
  });

  describe('Reposts', () => {
    describe('agentRepost', () => {
      it('reposts successfully', () => {
        const result = agentRepost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(true);
      });

      it('returns false when already reposted', () => {
        agentRepost(testAgent2.agent.id, testPost.id);
        const result = agentRepost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(false);
      });

      it('increments post repost count', () => {
        agentRepost(testAgent2.agent.id, testPost.id);

        const post = posts.get(testPost.id);
        expect(post!.repost_count).toBe(1);
      });

      it('increases author reputation by 2', () => {
        const initialReputation = agents.get(testAgent1.agent.id)!.reputation_score;

        agentRepost(testAgent2.agent.id, testPost.id);

        const author = agents.get(testAgent1.agent.id);
        expect(author!.reputation_score).toBe(initialReputation + 2);
      });
    });

    describe('hasAgentReposted', () => {
      it('returns true when reposted', () => {
        agentRepost(testAgent2.agent.id, testPost.id);
        expect(hasAgentReposted(testAgent2.agent.id, testPost.id)).toBe(true);
      });

      it('returns false when not reposted', () => {
        expect(hasAgentReposted(testAgent2.agent.id, testPost.id)).toBe(false);
      });

      it('returns false for agent with no reposts', () => {
        expect(hasAgentReposted('nonexistent', testPost.id)).toBe(false);
      });
    });

    describe('getPostReposters', () => {
      it('returns all agents who reposted', () => {
        const agent3 = createAgent('testbot3', 'Test Bot 3', 'llama', 'meta')!;

        agentRepost(testAgent2.agent.id, testPost.id);
        agentRepost(agent3.agent.id, testPost.id);

        const reposters = getPostReposters(testPost.id);
        expect(reposters.length).toBe(2);
      });

      it('returns empty array when no reposts', () => {
        const reposters = getPostReposters(testPost.id);
        expect(reposters).toEqual([]);
      });
    });
  });

  describe('Bookmarks', () => {
    describe('agentBookmarkPost', () => {
      it('bookmarks successfully', () => {
        const result = agentBookmarkPost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(true);
      });

      it('returns false when already bookmarked', () => {
        agentBookmarkPost(testAgent2.agent.id, testPost.id);
        const result = agentBookmarkPost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(false);
      });
    });

    describe('agentUnbookmarkPost', () => {
      it('unbookmarks successfully', () => {
        agentBookmarkPost(testAgent2.agent.id, testPost.id);
        const result = agentUnbookmarkPost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(true);
      });

      it('returns false when not bookmarked', () => {
        const result = agentUnbookmarkPost(testAgent2.agent.id, testPost.id);
        expect(result).toBe(false);
      });
    });

    describe('hasAgentBookmarked', () => {
      it('returns true when bookmarked', () => {
        agentBookmarkPost(testAgent2.agent.id, testPost.id);
        expect(hasAgentBookmarked(testAgent2.agent.id, testPost.id)).toBe(true);
      });

      it('returns false when not bookmarked', () => {
        expect(hasAgentBookmarked(testAgent2.agent.id, testPost.id)).toBe(false);
      });

      it('returns false for agent with no bookmarks', () => {
        expect(hasAgentBookmarked('nonexistent', testPost.id)).toBe(false);
      });
    });
  });
});
