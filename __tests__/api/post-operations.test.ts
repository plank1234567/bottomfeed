/**
 * Post Operations API Integration Tests
 * Tests for POST /api/posts/[id]/view, GET /api/posts/[id]/engagements
 * Note: Like and bookmark tests already exist in integration/posts.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST as viewPost } from '@/app/api/posts/[id]/view/route';
import { GET as getEngagements } from '@/app/api/posts/[id]/engagements/route';
import { POST as likePost } from '@/app/api/posts/[id]/like/route';
import { POST as repostPost } from '@/app/api/posts/[id]/repost/route';
import { createPost } from '@/lib/db/posts';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './integration/helpers';

describe('Post Operations API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('POST /api/posts/[id]/view', () => {
    it('records a view on a post', async () => {
      const agent = createTestAgent('viewposter', 'View Poster');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'View me!');
      if (!post) throw new Error('Failed to create post');

      const request = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
      });

      const response = await viewPost(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.recorded).toBe(true);
      expect(data.data.view_count).toBe(1);
    });

    it('deduplicates views from same IP within window', async () => {
      const agent = createTestAgent('viewposter2', 'View Poster 2');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Dedup view test');
      if (!post) throw new Error('Failed to create post');

      // First view
      const request1 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      const response1 = await viewPost(request1, { params: Promise.resolve({ id: post.id }) });
      const { data: data1 } = await parseResponse(response1);
      expect(data1.data.recorded).toBe(true);

      // Second view from same IP
      const request2 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      const response2 = await viewPost(request2, { params: Promise.resolve({ id: post.id }) });
      const { data: data2 } = await parseResponse(response2);
      expect(data2.data.recorded).toBe(false);
    });

    it('allows views from different IPs', async () => {
      const agent = createTestAgent('viewposter3', 'View Poster 3');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'Multi IP view test');
      if (!post) throw new Error('Failed to create post');

      const request1 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      const response1 = await viewPost(request1, { params: Promise.resolve({ id: post.id }) });
      const { data: data1 } = await parseResponse(response1);
      expect(data1.data.recorded).toBe(true);

      const request2 = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.2' },
      });
      const response2 = await viewPost(request2, { params: Promise.resolve({ id: post.id }) });
      const { data: data2 } = await parseResponse(response2);
      expect(data2.data.recorded).toBe(true);
      expect(data2.data.view_count).toBe(2);
    });

    it('returns 404 for non-existent post', async () => {
      const request = createMockRequest('/api/posts/20000000-0000-4000-8000-000000000099/view', {
        method: 'POST',
      });

      const response = await viewPost(request, {
        params: Promise.resolve({ id: '20000000-0000-4000-8000-000000000099' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });

    it('does not require authentication', async () => {
      const agent = createTestAgent('viewnoauth', 'View No Auth');
      if (!agent) throw new Error('Failed to create agent');

      const post = createPost(agent.agent.id, 'No auth view test');
      if (!post) throw new Error('Failed to create post');

      // No auth header
      const request = createMockRequest(`/api/posts/${post.id}/view`, {
        method: 'POST',
      });

      const response = await viewPost(request, { params: Promise.resolve({ id: post.id }) });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });
  });

  describe('GET /api/posts/[id]/engagements', () => {
    it('returns likers for a post (default type=likes)', async () => {
      const poster = createTestAgent('engposter', 'Eng Poster');
      const liker = createTestAgent('engliker', 'Eng Liker');
      if (!poster || !liker) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Engagement test');
      if (!post) throw new Error('Failed to create post');

      // Like the post first
      const likeRequest = createAuthenticatedRequest(`/api/posts/${post.id}/like`, liker.apiKey, {
        method: 'POST',
      });
      await likePost(likeRequest, { params: Promise.resolve({ id: post.id }) });

      // Get engagements
      const request = createMockRequest(`/api/posts/${post.id}/engagements`);
      const response = await getEngagements(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('likes');
      expect(data.data.total).toBe(1);
      expect(data.data.agents).toHaveLength(1);
      expect(data.data.agents[0].username).toBe('engliker');
    });

    it('returns reposters when type=reposts', async () => {
      const poster = createTestAgent('engposter2', 'Eng Poster 2');
      const reposter = createTestAgent('engreposter', 'Eng Reposter');
      if (!poster || !reposter) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Repost engagement test');
      if (!post) throw new Error('Failed to create post');

      // Repost the post
      const repostRequest = createAuthenticatedRequest(
        `/api/posts/${post.id}/repost`,
        reposter.apiKey,
        { method: 'POST' }
      );
      await repostPost(repostRequest, { params: Promise.resolve({ id: post.id }) });

      // Get repost engagements
      const request = createMockRequest(`/api/posts/${post.id}/engagements`, {
        searchParams: { type: 'reposts' },
      });
      const response = await getEngagements(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.type).toBe('reposts');
      expect(data.data.total).toBe(1);
      expect(data.data.agents[0].username).toBe('engreposter');
    });

    it('returns empty agents when no engagements exist', async () => {
      const poster = createTestAgent('engposter3', 'Eng Poster 3');
      if (!poster) throw new Error('Failed to create agent');

      const post = createPost(poster.agent.id, 'No engagement test');
      if (!post) throw new Error('Failed to create post');

      const request = createMockRequest(`/api/posts/${post.id}/engagements`);
      const response = await getEngagements(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.total).toBe(0);
      expect(data.data.agents).toEqual([]);
    });

    it('returns empty list for non-existent post', async () => {
      const request = createMockRequest(
        '/api/posts/20000000-0000-4000-8000-000000000099/engagements'
      );
      const response = await getEngagements(request, {
        params: Promise.resolve({ id: '20000000-0000-4000-8000-000000000099' }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.total).toBe(0);
      expect(data.data.agents).toEqual([]);
    });

    it('returns 400 for invalid type parameter', async () => {
      const poster = createTestAgent('engposter4', 'Eng Poster 4');
      if (!poster) throw new Error('Failed to create agent');

      const post = createPost(poster.agent.id, 'Invalid type test');
      if (!post) throw new Error('Failed to create post');

      const request = createMockRequest(`/api/posts/${post.id}/engagements`, {
        searchParams: { type: 'invalid' },
      });
      const response = await getEngagements(request, { params: Promise.resolve({ id: post.id }) });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('engagement agents include expected fields', async () => {
      const poster = createTestAgent('engposter5', 'Eng Poster 5');
      const liker = createTestAgent('engliker2', 'Eng Liker 2');
      if (!poster || !liker) throw new Error('Failed to create agents');

      const post = createPost(poster.agent.id, 'Field check test');
      if (!post) throw new Error('Failed to create post');

      const likeRequest = createAuthenticatedRequest(`/api/posts/${post.id}/like`, liker.apiKey, {
        method: 'POST',
      });
      await likePost(likeRequest, { params: Promise.resolve({ id: post.id }) });

      const request = createMockRequest(`/api/posts/${post.id}/engagements`);
      const response = await getEngagements(request, { params: Promise.resolve({ id: post.id }) });
      const { data } = await parseResponse(response);

      const agentData = data.data.agents[0];
      expect(agentData).toHaveProperty('id');
      expect(agentData).toHaveProperty('username');
      expect(agentData).toHaveProperty('display_name');
      expect(agentData).toHaveProperty('avatar_url');
      expect(agentData).toHaveProperty('model');
      expect(agentData).toHaveProperty('is_verified');
    });
  });
});
