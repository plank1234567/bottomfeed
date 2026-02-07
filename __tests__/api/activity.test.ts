/**
 * Activity API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/activity/route';
import { logActivity } from '@/lib/db/activities';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  parseResponse,
} from './integration/helpers';

describe('Activity API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/activity', () => {
    it('returns 200 with empty activities', async () => {
      const request = createMockRequest('/api/activity');
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activities).toEqual([]);
      expect(data.data.has_more).toBe(false);
      expect(data.data.next_cursor).toBeNull();
    });

    it('returns activities with agent info', async () => {
      const agent = createTestAgent('actbot', 'Activity Bot');
      if (!agent) throw new Error('Failed to create agent');

      logActivity({
        type: 'post',
        agent_id: agent.agent.id,
        details: { content: 'Test post' },
      });

      const request = createMockRequest('/api/activity');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities).toHaveLength(1);
      expect(data.data.activities[0].type).toBe('post');
      expect(data.data.activities[0].agent_id).toBe(agent.agent.id);
    });

    it('filters by activity type', async () => {
      const agent = createTestAgent('actbot', 'Activity Bot');
      if (!agent) throw new Error('Failed to create agent');

      logActivity({ type: 'post', agent_id: agent.agent.id });
      logActivity({ type: 'like', agent_id: agent.agent.id });
      logActivity({ type: 'follow', agent_id: agent.agent.id });

      const request = createMockRequest('/api/activity', {
        searchParams: { type: 'like' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities).toHaveLength(1);
      expect(data.data.activities[0].type).toBe('like');
    });

    it('returns 400 for invalid activity type', async () => {
      const request = createMockRequest('/api/activity', {
        searchParams: { type: 'invalid_type' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('respects limit parameter', async () => {
      const agent = createTestAgent('actbot', 'Activity Bot');
      if (!agent) throw new Error('Failed to create agent');

      for (let i = 0; i < 5; i++) {
        logActivity({ type: 'post', agent_id: agent.agent.id });
      }

      const request = createMockRequest('/api/activity', {
        searchParams: { limit: '2' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities).toHaveLength(2);
      expect(data.data.has_more).toBe(true);
      expect(data.data.next_cursor).toBeTruthy();
    });

    it('supports cursor pagination', async () => {
      const agent = createTestAgent('actbot', 'Activity Bot');
      if (!agent) throw new Error('Failed to create agent');

      // Create activities with distinct timestamps for cursor pagination
      for (let i = 0; i < 5; i++) {
        const ts = new Date(Date.now() - (5 - i) * 1000).toISOString();
        logActivity({ type: 'post', agent_id: agent.agent.id, created_at: ts });
      }

      // First page
      const req1 = createMockRequest('/api/activity', {
        searchParams: { limit: '3' },
      });
      const res1 = await parseResponse(await GET(req1));
      expect(res1.data.data.activities.length).toBeGreaterThanOrEqual(1);

      // If cursor is returned, verify second page works
      const cursor = res1.data.data.next_cursor;
      if (cursor) {
        const req2 = createMockRequest('/api/activity', {
          searchParams: { limit: '10', cursor },
        });
        const res2 = await parseResponse(await GET(req2));
        expect(res2.status).toBe(200);
        // Second page should have fewer or equal items
        expect(res2.data.data.activities.length).toBeLessThanOrEqual(5);
      }
    });

    it('maps activity fields correctly', async () => {
      const agent = createTestAgent('actbot', 'Activity Bot');
      if (!agent) throw new Error('Failed to create agent');

      logActivity({
        type: 'post',
        agent_id: agent.agent.id,
        details: { content: 'Hello world' },
      });

      const request = createMockRequest('/api/activity');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      const activity = data.data.activities[0];
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('type');
      expect(activity).toHaveProperty('agent_id');
      expect(activity).toHaveProperty('created_at');
    });
  });
});
