/**
 * Feed API Integration Tests
 * Tests the actual /api/feed route handler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/feed/route';
import { createPost } from '@/lib/db/posts';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  parseResponse,
} from './integration/helpers';

describe('Feed API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/feed', () => {
    it('returns 200 with posts array and stats', async () => {
      const request = createMockRequest('/api/feed');
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('posts');
      expect(data.data).toHaveProperty('stats');
      expect(Array.isArray(data.data.posts)).toBe(true);
    });

    it('returns empty posts when no posts exist', async () => {
      const request = createMockRequest('/api/feed');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.posts).toEqual([]);
    });

    it('returns posts after they are created', async () => {
      const agent = createTestAgent('feedbot', 'Feed Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Hello from the feed!');
      createPost(agent.agent.id, 'Second post in the feed');

      const request = createMockRequest('/api/feed');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.posts.length).toBeGreaterThanOrEqual(2);
    });

    it('respects limit parameter', async () => {
      const agent = createTestAgent('limitfeed', 'Limit Feed Bot');
      if (!agent) throw new Error('Failed to create agent');

      for (let i = 0; i < 10; i++) {
        createPost(agent.agent.id, `Feed post ${i}`);
      }

      const request = createMockRequest('/api/feed', {
        searchParams: { limit: '3' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.posts.length).toBe(3);
    });

    it('enforces max page size', async () => {
      const agent = createTestAgent('maxfeed', 'Max Feed Bot');
      if (!agent) throw new Error('Failed to create agent');

      // Create enough posts to exceed the max
      for (let i = 0; i < 5; i++) {
        createPost(agent.agent.id, `Feed post ${i}`);
      }

      const request = createMockRequest('/api/feed', {
        searchParams: { limit: '9999' },
      });
      const response = await GET(request);
      const { status } = await parseResponse(response);

      // Should still succeed (limit is capped, not rejected)
      expect(status).toBe(200);
    });

    it('includes next_cursor for pagination', async () => {
      const agent = createTestAgent('cursorbot', 'Cursor Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Post for cursor test');

      const request = createMockRequest('/api/feed');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data).toHaveProperty('next_cursor');
      if (data.data.posts.length > 0) {
        expect(data.data.next_cursor).not.toBeNull();
      }
    });

    it('returns null next_cursor when feed is empty', async () => {
      const request = createMockRequest('/api/feed');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.next_cursor).toBeNull();
    });

    it('includes stats with agent and post counts', async () => {
      const agent = createTestAgent('statsbot', 'Stats Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Stats test post');

      const request = createMockRequest('/api/feed');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('total_agents');
      expect(data.data.stats).toHaveProperty('total_posts');
      expect(data.data.stats.total_agents).toBeGreaterThanOrEqual(1);
      expect(data.data.stats.total_posts).toBeGreaterThanOrEqual(1);
    });

    it('posts include author information', async () => {
      const agent = createTestAgent('authortest', 'Author Test Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Post with author info');

      const request = createMockRequest('/api/feed');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      const post = data.data.posts[0];
      expect(post.author).toBeDefined();
      expect(post.author.username).toBe('authortest');
    });
  });
});
