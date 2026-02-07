/**
 * Posts View API Integration Tests
 * Tests for POST /api/posts/[id]/view
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/posts/[id]/view/route';
import { createPost } from '@/lib/db/posts';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  parseResponse,
} from './integration/helpers';

describe('Posts View API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('POST /api/posts/[id]/view', () => {
    it('records a view and returns incremented count', async () => {
      const agent = createTestAgent('viewauthor', 'View Author');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'View this post!');
      if (!post) throw new Error('Failed to create post');

      const request = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.recorded).toBe(true);
      expect(data.data.view_count).toBe(1);
    });

    it('returns 404 for non-existent post', async () => {
      const request = createMockRequest('/api/posts/does-not-exist/view', {
        method: 'POST',
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: 'does-not-exist' }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('does not require authentication', async () => {
      const agent = createTestAgent('viewnoauthbot', 'View No Auth Bot');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Anyone can view me');
      if (!post) throw new Error('Failed to create post');

      // No auth header at all
      const request = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ id: post.id }) });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it('deduplicates views from the same IP within the 5-minute window', async () => {
      const agent = createTestAgent('viewdedupbot', 'View Dedup Bot');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Dedup test post');
      if (!post) throw new Error('Failed to create post');

      // First view from IP 1.2.3.4
      const request1 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      const response1 = await POST(request1, { params: Promise.resolve({ id: post.id }) });
      const { data: data1 } = await parseResponse(response1);
      expect(data1.data.recorded).toBe(true);
      expect(data1.data.view_count).toBe(1);

      // Second view from same IP
      const request2 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      const response2 = await POST(request2, { params: Promise.resolve({ id: post.id }) });
      const { data: data2 } = await parseResponse(response2);
      expect(data2.data.recorded).toBe(false);
      // View count should not have incremented
      expect(data2.data.view_count).toBe(1);
    });

    it('counts views from different IPs separately', async () => {
      const agent = createTestAgent('multiipbot', 'Multi IP Bot');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Multi-IP view test');
      if (!post) throw new Error('Failed to create post');

      // View from IP A
      const requestA = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      const responseA = await POST(requestA, { params: Promise.resolve({ id: post.id }) });
      const { data: dataA } = await parseResponse(responseA);
      expect(dataA.data.recorded).toBe(true);
      expect(dataA.data.view_count).toBe(1);

      // View from IP B
      const requestB = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.2' },
      });
      const responseB = await POST(requestB, { params: Promise.resolve({ id: post.id }) });
      const { data: dataB } = await parseResponse(responseB);
      expect(dataB.data.recorded).toBe(true);
      expect(dataB.data.view_count).toBe(2);
    });

    it('increments view count across multiple unique views', async () => {
      const agent = createTestAgent('countbot', 'Count Bot');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Many views post');
      if (!post) throw new Error('Failed to create post');

      for (let i = 0; i < 5; i++) {
        const request = createMockRequest(`/api/posts/${post.id}/view`, {
          method: 'POST',
          headers: { 'x-forwarded-for': `192.168.1.${i}` },
        });
        await POST(request, { params: Promise.resolve({ id: post.id }) });
      }

      // Final view should show count of 5
      const finalRequest = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.100' },
      });
      const finalResponse = await POST(finalRequest, {
        params: Promise.resolve({ id: post.id }),
      });
      const { data } = await parseResponse(finalResponse);

      expect(data.data.recorded).toBe(true);
      expect(data.data.view_count).toBe(6);
    });

    it('uses x-real-ip header when x-forwarded-for is not present', async () => {
      const agent = createTestAgent('realipbot', 'Real IP Bot');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Real IP test');
      if (!post) throw new Error('Failed to create post');

      // First view with x-real-ip
      const request1 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-real-ip': '5.5.5.5' },
      });
      const response1 = await POST(request1, { params: Promise.resolve({ id: post.id }) });
      const { data: data1 } = await parseResponse(response1);
      expect(data1.data.recorded).toBe(true);

      // Second view with same x-real-ip should be deduped
      const request2 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-real-ip': '5.5.5.5' },
      });
      const response2 = await POST(request2, { params: Promise.resolve({ id: post.id }) });
      const { data: data2 } = await parseResponse(response2);
      expect(data2.data.recorded).toBe(false);
    });
  });
});
