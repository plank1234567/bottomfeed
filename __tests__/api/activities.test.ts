/**
 * Activities API Integration Tests
 * Tests for GET /api/activities and GET /api/activity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getActivities } from '@/app/api/activities/route';
import { GET as getActivity } from '@/app/api/activity/route';
import { createPost } from '@/lib/db/posts';
import { logActivity } from '@/lib/db/activities';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  parseResponse,
} from './integration/helpers';

describe('Activities API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/activities', () => {
    it('returns 200 with activities array and stats', async () => {
      const request = createMockRequest('/api/activities');
      const response = await getActivities(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('activities');
      expect(data.data).toHaveProperty('stats');
      expect(Array.isArray(data.data.activities)).toBe(true);
    });

    it('returns empty activities when none exist', async () => {
      const request = createMockRequest('/api/activities');
      const response = await getActivities(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities).toEqual([]);
    });

    it('returns activities after creating a post', async () => {
      const agent = createTestAgent('activebot', 'Active Bot');
      if (!agent) throw new Error('Failed to create agent');

      // createPost logs an activity internally
      createPost(agent.agent.id, 'Hello world!');

      const request = createMockRequest('/api/activities');
      const response = await getActivities(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities.length).toBeGreaterThan(0);
    });

    it('respects limit parameter', async () => {
      const agent = createTestAgent('limitbot', 'Limit Bot');
      if (!agent) throw new Error('Failed to create agent');

      // Create multiple activities
      for (let i = 0; i < 5; i++) {
        createPost(agent.agent.id, `Post ${i}`);
      }

      const request = createMockRequest('/api/activities', {
        searchParams: { limit: '2' },
      });
      const response = await getActivities(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities.length).toBeLessThanOrEqual(2);
    });

    it('returns activities with correct structure', async () => {
      const agent = createTestAgent('structbot', 'Struct Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Test post for structure');

      const request = createMockRequest('/api/activities');
      const response = await getActivities(request);
      const { data } = await parseResponse(response);

      const activity = data.data.activities[0];
      expect(activity).toHaveProperty('id');
      expect(activity).toHaveProperty('type');
      expect(activity).toHaveProperty('created_at');
    });
  });

  describe('GET /api/activity', () => {
    it('returns 200 with activities array', async () => {
      const request = createMockRequest('/api/activity');
      const response = await getActivity(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('activities');
      expect(Array.isArray(data.data.activities)).toBe(true);
    });

    it('returns empty activities when none exist', async () => {
      const request = createMockRequest('/api/activity');
      const response = await getActivity(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities).toEqual([]);
    });

    it('filters activities by type', async () => {
      const agent = createTestAgent('filterbot', 'Filter Bot');
      if (!agent) throw new Error('Failed to create agent');

      // Create a post activity
      createPost(agent.agent.id, 'Test post');

      // Also log a follow activity manually
      logActivity(agent.agent.id, 'follow', undefined, 'some-target-id');

      const request = createMockRequest('/api/activity', {
        searchParams: { type: 'post' },
      });
      const response = await getActivity(request);
      const { data } = await parseResponse(response);

      // All returned activities should be of type 'post'
      for (const activity of data.data.activities) {
        expect(activity.type).toBe('post');
      }
    });

    it('respects limit parameter', async () => {
      const agent = createTestAgent('limitbot2', 'Limit Bot 2');
      if (!agent) throw new Error('Failed to create agent');

      for (let i = 0; i < 5; i++) {
        createPost(agent.agent.id, `Post ${i}`);
      }

      const request = createMockRequest('/api/activity', {
        searchParams: { limit: '3' },
      });
      const response = await getActivity(request);
      const { data } = await parseResponse(response);

      expect(data.data.activities.length).toBeLessThanOrEqual(3);
    });

    it('includes agent information in activities', async () => {
      const agent = createTestAgent('agentinfobot', 'Agent Info Bot');
      if (!agent) throw new Error('Failed to create agent');

      createPost(agent.agent.id, 'Hello world!');

      const request = createMockRequest('/api/activity');
      const response = await getActivity(request);
      const { data } = await parseResponse(response);

      const activity = data.data.activities.find(
        (a: { agent?: { username: string } }) => a.agent?.username === 'agentinfobot'
      );
      expect(activity).toBeDefined();
      if (activity?.agent) {
        expect(activity.agent.username).toBe('agentinfobot');
        expect(activity.agent.display_name).toBe('Agent Info Bot');
      }
    });
  });
});
