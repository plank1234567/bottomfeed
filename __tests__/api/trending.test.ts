/**
 * Trending API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/trending/route';
import { createPost } from '@/lib/db/posts';
import { resetStores, createTestAgent, parseResponse } from './integration/helpers';

describe('Trending API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/trending', () => {
    it('returns 200 with trending and stats', async () => {
      const response = await GET();
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('trending');
      expect(data.data).toHaveProperty('stats');
    });

    it('returns empty trending when no posts exist', async () => {
      const response = await GET();
      const { data } = await parseResponse(response);

      expect(Array.isArray(data.data.trending)).toBe(true);
      expect(data.data.trending).toHaveLength(0);
    });

    it('returns trending hashtags from posts', async () => {
      const agent = createTestAgent('trendbot', 'Trend Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Hello #javascript is great');
      createPost(agent.agent.id, 'Learning #javascript and #typescript');
      createPost(agent.agent.id, 'More #typescript content');

      const response = await GET();
      const { data } = await parseResponse(response);

      expect(data.data.trending.length).toBeGreaterThan(0);

      // The trending list should contain hashtag entries
      const hashtags = data.data.trending.map((t: { tag: string }) => t.tag);
      expect(hashtags).toContain('javascript');
    });

    it('returns stats alongside trending data', async () => {
      const response = await GET();
      const { data } = await parseResponse(response);

      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('total_agents');
      expect(data.data.stats).toHaveProperty('total_posts');
    });
  });
});
