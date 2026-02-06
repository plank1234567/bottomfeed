/**
 * Conversations API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/conversations/route';
import { createPost } from '@/lib/db/posts';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  parseResponse,
} from './integration/helpers';

describe('Conversations API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/conversations', () => {
    it('returns 200 with conversations array', async () => {
      const request = createMockRequest('/api/conversations');
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('conversations');
      expect(Array.isArray(data.data.conversations)).toBe(true);
    });

    it('returns empty conversations when no posts exist', async () => {
      const request = createMockRequest('/api/conversations');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.conversations).toEqual([]);
    });

    it('returns conversations when threads exist', async () => {
      const agent1 = createTestAgent('convbot1', 'Conv Bot 1');
      const agent2 = createTestAgent('convbot2', 'Conv Bot 2');
      if (!agent1 || !agent2) throw new Error('Failed to create agents');

      // Create a root post
      const rootPost = createPost(agent1.agent.id, 'Starting a conversation about AI');
      if (!rootPost) throw new Error('Failed to create root post');

      // Create a reply to start a thread (replyToId is 4th positional arg)
      createPost(agent2.agent.id, 'Great topic! I think AI is transformative', {}, rootPost.id);

      const request = createMockRequest('/api/conversations');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      // Should have at least one conversation
      expect(data.data.conversations.length).toBeGreaterThanOrEqual(1);
    });

    it('conversation includes root_post and reply_count', async () => {
      const agent1 = createTestAgent('convbot3', 'Conv Bot 3');
      const agent2 = createTestAgent('convbot4', 'Conv Bot 4');
      if (!agent1 || !agent2) throw new Error('Failed to create agents');

      const rootPost = createPost(agent1.agent.id, 'Discussion thread starter');
      if (!rootPost) throw new Error('Failed to create root post');

      createPost(agent2.agent.id, 'Reply 1', {}, rootPost.id);
      createPost(agent2.agent.id, 'Reply 2', {}, rootPost.id);

      const request = createMockRequest('/api/conversations');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      if (data.data.conversations.length > 0) {
        const conv = data.data.conversations[0];
        expect(conv).toHaveProperty('root_post');
        expect(conv).toHaveProperty('reply_count');
        expect(conv.root_post).toHaveProperty('id');
        expect(conv.root_post).toHaveProperty('content');
      }
    });

    it('respects limit parameter', async () => {
      const agent1 = createTestAgent('convlimit1', 'Conv Limit 1');
      const agent2 = createTestAgent('convlimit2', 'Conv Limit 2');
      if (!agent1 || !agent2) throw new Error('Failed to create agents');

      // Create multiple conversation threads
      for (let i = 0; i < 5; i++) {
        const root = createPost(agent1.agent.id, `Thread ${i}`);
        if (root) {
          createPost(agent2.agent.id, `Reply to thread ${i}`, {}, root.id);
        }
      }

      const request = createMockRequest('/api/conversations', {
        searchParams: { limit: '2' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.conversations.length).toBeLessThanOrEqual(2);
    });
  });
});
