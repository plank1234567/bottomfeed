/**
 * Search API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/search/route';
import { createPost } from '@/lib/db/posts';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  parseResponse,
} from './integration/helpers';

describe('Search API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/search', () => {
    it('returns empty results when query is omitted', async () => {
      const request = createMockRequest('/api/search');
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.agents).toEqual([]);
      expect(data.data.posts).toEqual([]);
      expect(data.data.query).toBe('');
    });

    it('returns empty results when no query param provided', async () => {
      const request = createMockRequest('/api/search');
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.agents).toEqual([]);
      expect(data.data.posts).toEqual([]);
    });

    it('returns 400 for query shorter than 2 characters', async () => {
      const request = createMockRequest('/api/search', {
        searchParams: { q: 'x' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('searches for agents by username', async () => {
      createTestAgent('pythonbot', 'Python Expert');
      createTestAgent('jsbot', 'JavaScript Pro');

      const request = createMockRequest('/api/search', {
        searchParams: { q: 'pythonbot', type: 'agents' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.agents.length).toBeGreaterThan(0);
      const usernames = data.data.agents.map((a: { username: string }) => a.username);
      expect(usernames).toContain('pythonbot');
    });

    it('searches for posts by content', async () => {
      const agent = createTestAgent('searcher', 'Searcher Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Testing the quantum computing revolution');
      createPost(agent.agent.id, 'Regular post about nothing');

      const request = createMockRequest('/api/search', {
        searchParams: { q: 'quantum', type: 'posts' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.posts.length).toBeGreaterThan(0);
      expect(data.data.total_posts).toBeGreaterThan(0);
    });

    it('searches both agents and posts by default (type=all)', async () => {
      const agent = createTestAgent('allsearch', 'All Search Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Post about allsearch topic');

      const request = createMockRequest('/api/search', {
        searchParams: { q: 'allsearch' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      // Should search both agents and posts
      expect(data.data).toHaveProperty('agents');
      expect(data.data).toHaveProperty('posts');
      expect(data.data).toHaveProperty('total_agents');
      expect(data.data).toHaveProperty('total_posts');
    });

    it('supports hashtag search with # prefix', async () => {
      const agent = createTestAgent('hashbot', 'Hash Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Learning #rust programming');
      createPost(agent.agent.id, 'Building with #python');

      const request = createMockRequest('/api/search', {
        searchParams: { q: '#rust' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      // Hashtag search returns posts
      expect(data.data.posts.length).toBeGreaterThanOrEqual(1);
    });

    it('returns correct query in response', async () => {
      const request = createMockRequest('/api/search', {
        searchParams: { q: 'test query' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.query).toBe('test query');
    });

    it('respects limit parameter', async () => {
      const agent = createTestAgent('limitbot', 'Limit Bot');
      if (!agent) throw new Error('Failed to create agent');

      for (let i = 0; i < 10; i++) {
        createPost(agent.agent.id, `Searchable content item ${i}`);
      }

      const request = createMockRequest('/api/search', {
        searchParams: { q: 'Searchable content', type: 'posts', limit: '3' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.posts.length).toBeLessThanOrEqual(3);
    });
  });
});
