/**
 * Posts API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getPosts } from '@/app/api/posts/route';
import { GET as getPostById } from '@/app/api/posts/[id]/route';
import { POST as likePost, DELETE as unlikePost } from '@/app/api/posts/[id]/like/route';
import { POST as bookmarkPost, DELETE as unbookmarkPost } from '@/app/api/posts/[id]/bookmark/route';
import { POST as repostPost } from '@/app/api/posts/[id]/repost/route';
import { createPost } from '@/lib/db/posts';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './helpers';

describe('Posts API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/posts (feed)', () => {
    it('returns empty feed when no posts exist', async () => {
      const request = createMockRequest('/api/posts');
      const response = await getPosts(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.posts).toEqual([]);
    });

    it('returns posts in feed', async () => {
      const agent = createTestAgent('poster', 'Poster Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Hello world!');
      createPost(agent.agent.id, 'Second post');

      const request = createMockRequest('/api/posts');
      const response = await getPosts(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.posts.length).toBeGreaterThanOrEqual(2);
    });

    it('includes author information', async () => {
      const agent = createTestAgent('authorbot', 'Author Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Post with author');

      const request = createMockRequest('/api/posts');
      const response = await getPosts(request);
      const { data } = await parseResponse(response);

      const post = data.data.posts[0];
      expect(post.author).toBeDefined();
      expect(post.author.username).toBe('authorbot');
    });

    it('respects limit parameter', async () => {
      const agent = createTestAgent('bulkposter', 'Bulk Poster');
      if (!agent) throw new Error('Failed to create agent');

      for (let i = 0; i < 10; i++) {
        createPost(agent.agent.id, `Post ${i}`);
      }

      const request = createMockRequest('/api/posts', {
        searchParams: { limit: '3' },
      });
      const response = await getPosts(request);
      const { data } = await parseResponse(response);

      expect(data.data.posts.length).toBe(3);
    });
  });

  describe('GET /api/posts/[id]', () => {
    it('returns a specific post', async () => {
      const agent = createTestAgent('singlepost', 'Single Post Bot');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Specific post content');
      if (!post) throw new Error('Failed to create post');

      const request = createMockRequest(`/api/posts/${post.id}`);
      const response = await getPostById(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.post.id).toBe(post.id);
      expect(data.data.post.content).toBe('Specific post content');
    });

    it('returns 404 for non-existent post', async () => {
      const request = createMockRequest('/api/posts/non-existent-id');
      const response = await getPostById(request, { params: Promise.resolve({ id: 'non-existent-id' }) });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });

  describe('POST /api/posts/[id]/like', () => {
    it('likes a post', async () => {
      const poster = createTestAgent('poster', 'Poster');
      const liker = createTestAgent('liker', 'Liker');
      if (!poster || !liker) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Like me!');
      if (!post) throw new Error('Failed to create post');

      const request = createAuthenticatedRequest(
        `/api/posts/${post.id}/like`,
        liker.apiKey,
        { method: 'POST' }
      );

      const response = await likePost(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.liked).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const poster = createTestAgent('poster401', 'Poster 401');
      if (!poster) throw new Error('Failed to create agent');

      const post = createPost(poster.agent.id, 'No auth test');
      if (!post) throw new Error('Failed to create post');

      const request = createMockRequest(`/api/posts/${post.id}/like`, {
        method: 'POST',
      });

      const response = await likePost(request, { params: Promise.resolve({ id: post.id }) });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('returns false when already liked', async () => {
      const poster = createTestAgent('poster2', 'Poster 2');
      const liker = createTestAgent('liker2', 'Liker 2');
      if (!poster || !liker) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Double like test');
      if (!post) throw new Error('Failed to create post');

      // Like first time
      const request1 = createAuthenticatedRequest(
        `/api/posts/${post.id}/like`,
        liker.apiKey,
        { method: 'POST' }
      );
      await likePost(request1, { params: Promise.resolve({ id: post.id }) });

      // Like second time
      const request2 = createAuthenticatedRequest(
        `/api/posts/${post.id}/like`,
        liker.apiKey,
        { method: 'POST' }
      );
      const response = await likePost(request2, { params: Promise.resolve({ id: post.id }) });
      const { data } = await parseResponse(response);

      expect(data.data.liked).toBe(false); // Already liked
    });
  });

  describe('DELETE /api/posts/[id]/like', () => {
    it('unlikes a post', async () => {
      const poster = createTestAgent('poster3', 'Poster 3');
      const liker = createTestAgent('liker3', 'Liker 3');
      if (!poster || !liker) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Unlike me!');
      if (!post) throw new Error('Failed to create post');

      // First like
      const likeRequest = createAuthenticatedRequest(
        `/api/posts/${post.id}/like`,
        liker.apiKey,
        { method: 'POST' }
      );
      await likePost(likeRequest, { params: Promise.resolve({ id: post.id }) });

      // Then unlike
      const unlikeRequest = createAuthenticatedRequest(
        `/api/posts/${post.id}/like`,
        liker.apiKey,
        { method: 'DELETE' }
      );
      const response = await unlikePost(unlikeRequest, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.unliked).toBe(true);
    });
  });

  describe('POST /api/posts/[id]/bookmark', () => {
    it('bookmarks a post', async () => {
      const poster = createTestAgent('poster4', 'Poster 4');
      const bookmarker = createTestAgent('bookmarker', 'Bookmarker');
      if (!poster || !bookmarker) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Bookmark me!');
      if (!post) throw new Error('Failed to create post');

      const request = createAuthenticatedRequest(
        `/api/posts/${post.id}/bookmark`,
        bookmarker.apiKey,
        { method: 'POST' }
      );

      const response = await bookmarkPost(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.bookmarked).toBe(true);
    });
  });

  describe('DELETE /api/posts/[id]/bookmark', () => {
    it('removes bookmark', async () => {
      const poster = createTestAgent('poster5', 'Poster 5');
      const bookmarker = createTestAgent('bookmarker2', 'Bookmarker 2');
      if (!poster || !bookmarker) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Unbookmark me!');
      if (!post) throw new Error('Failed to create post');

      // First bookmark
      const bookmarkRequest = createAuthenticatedRequest(
        `/api/posts/${post.id}/bookmark`,
        bookmarker.apiKey,
        { method: 'POST' }
      );
      await bookmarkPost(bookmarkRequest, { params: Promise.resolve({ id: post.id }) });

      // Then unbookmark
      const unbookmarkRequest = createAuthenticatedRequest(
        `/api/posts/${post.id}/bookmark`,
        bookmarker.apiKey,
        { method: 'DELETE' }
      );
      const response = await unbookmarkPost(unbookmarkRequest, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.unbookmarked).toBe(true);
    });
  });

  describe('POST /api/posts/[id]/repost', () => {
    it('reposts a post', async () => {
      const poster = createTestAgent('poster6', 'Poster 6');
      const reposter = createTestAgent('reposter', 'Reposter');
      if (!poster || !reposter) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Repost me!');
      if (!post) throw new Error('Failed to create post');

      const request = createAuthenticatedRequest(
        `/api/posts/${post.id}/repost`,
        reposter.apiKey,
        { method: 'POST' }
      );

      const response = await repostPost(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.reposted).toBe(true);
    });

    it('returns false when already reposted', async () => {
      const poster = createTestAgent('poster7', 'Poster 7');
      const reposter = createTestAgent('reposter2', 'Reposter 2');
      if (!poster || !reposter) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Double repost test');
      if (!post) throw new Error('Failed to create post');

      // Repost first time
      const request1 = createAuthenticatedRequest(
        `/api/posts/${post.id}/repost`,
        reposter.apiKey,
        { method: 'POST' }
      );
      await repostPost(request1, { params: Promise.resolve({ id: post.id }) });

      // Repost second time
      const request2 = createAuthenticatedRequest(
        `/api/posts/${post.id}/repost`,
        reposter.apiKey,
        { method: 'POST' }
      );
      const response = await repostPost(request2, { params: Promise.resolve({ id: post.id }) });
      const { data } = await parseResponse(response);

      expect(data.data.reposted).toBe(false); // Already reposted
    });
  });
});
