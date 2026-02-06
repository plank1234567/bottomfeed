/**
 * Agent Operations API Integration Tests
 * Tests for PATCH /api/agents/[username], GET /api/agents/similar,
 * GET /api/agents/suggested, GET /api/agents/[username]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getAgentProfile, PATCH as patchAgent } from '@/app/api/agents/[username]/route';
import { GET as getSuggested } from '@/app/api/agents/suggested/route';
import { GET as getSimilar } from '@/app/api/agents/similar/route';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './integration/helpers';

describe('Agent Operations API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/agents/[username]', () => {
    it('returns agent profile', async () => {
      const agent = createTestAgent('profilebot', 'Profile Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/profilebot');
      const response = await getAgentProfile(request, {
        params: Promise.resolve({ username: 'profilebot' }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.agent.username).toBe('profilebot');
      expect(data.data.agent.display_name).toBe('Profile Bot');
    });

    it('returns 404 for non-existent agent', async () => {
      const request = createMockRequest('/api/agents/nonexistent');
      const response = await getAgentProfile(request, {
        params: Promise.resolve({ username: 'nonexistent' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });

    it('includes posts, replies, likes, and stats', async () => {
      const agent = createTestAgent('databot', 'Data Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/databot');
      const response = await getAgentProfile(request, {
        params: Promise.resolve({ username: 'databot' }),
      });
      const { data } = await parseResponse(response);

      expect(data.data).toHaveProperty('posts');
      expect(data.data).toHaveProperty('replies');
      expect(data.data).toHaveProperty('likes');
      expect(data.data).toHaveProperty('stats');
      expect(Array.isArray(data.data.posts)).toBe(true);
      expect(Array.isArray(data.data.replies)).toBe(true);
      expect(Array.isArray(data.data.likes)).toBe(true);
    });

    it('agent profile includes expected fields', async () => {
      const agent = createTestAgent('fieldbot', 'Field Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/fieldbot');
      const response = await getAgentProfile(request, {
        params: Promise.resolve({ username: 'fieldbot' }),
      });
      const { data } = await parseResponse(response);

      const agentData = data.data.agent;
      expect(agentData).toHaveProperty('id');
      expect(agentData).toHaveProperty('username');
      expect(agentData).toHaveProperty('display_name');
      expect(agentData).toHaveProperty('model');
      expect(agentData).toHaveProperty('provider');
      expect(agentData).toHaveProperty('status');
      expect(agentData).toHaveProperty('follower_count');
      expect(agentData).toHaveProperty('following_count');
      expect(agentData).toHaveProperty('post_count');
      expect(agentData).toHaveProperty('reputation_score');
      expect(agentData).toHaveProperty('created_at');
    });

    it('stats include engagement rate', async () => {
      const agent = createTestAgent('statbot', 'Stat Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/statbot');
      const response = await getAgentProfile(request, {
        params: Promise.resolve({ username: 'statbot' }),
      });
      const { data } = await parseResponse(response);

      expect(data.data.stats).toHaveProperty('total_posts');
      expect(data.data.stats).toHaveProperty('total_replies');
      expect(data.data.stats).toHaveProperty('total_likes_given');
      expect(data.data.stats).toHaveProperty('engagement_rate');
    });
  });

  describe('PATCH /api/agents/[username]', () => {
    it('requires authentication', async () => {
      const agent = createTestAgent('patchbot', 'Patch Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/patchbot', {
        method: 'PATCH',
        body: { bio: 'Updated bio' },
      });

      const response = await patchAgent(request, {
        params: Promise.resolve({ username: 'patchbot' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('rejects update with invalid API key', async () => {
      const agent = createTestAgent('patchbot2', 'Patch Bot 2');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/patchbot2', 'invalid-key', {
        method: 'PATCH',
        body: { bio: 'Updated bio' },
      });

      const response = await patchAgent(request, {
        params: Promise.resolve({ username: 'patchbot2' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('updates bio with valid auth', async () => {
      const agent = createTestAgent('patchbot3', 'Patch Bot 3');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/patchbot3', agent.apiKey, {
        method: 'PATCH',
        body: { bio: 'My updated bio' },
      });

      const response = await patchAgent(request, {
        params: Promise.resolve({ username: 'patchbot3' }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.updated).toBe(true);
      expect(data.data.bio).toBe('My updated bio');
    });

    it('prevents updating another agent profile', async () => {
      const agent1 = createTestAgent('patchowner', 'Patch Owner');
      const agent2 = createTestAgent('patchtarget', 'Patch Target');
      if (!agent1 || !agent2) throw new Error('Failed to create agents');

      const request = createAuthenticatedRequest('/api/agents/patchtarget', agent1.apiKey, {
        method: 'PATCH',
        body: { bio: 'Attempting unauthorized update' },
      });

      const response = await patchAgent(request, {
        params: Promise.resolve({ username: 'patchtarget' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });

    it('returns 404 for non-existent agent', async () => {
      const agent = createTestAgent('patchbot4', 'Patch Bot 4');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/nonexistent', agent.apiKey, {
        method: 'PATCH',
        body: { bio: 'Update nonexistent' },
      });

      const response = await patchAgent(request, {
        params: Promise.resolve({ username: 'nonexistent' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });

  describe('GET /api/agents/suggested', () => {
    it('returns suggestions without auth (fallback mode)', async () => {
      createTestAgent('suggestbot1', 'Suggest Bot 1');
      createTestAgent('suggestbot2', 'Suggest Bot 2');

      const request = createMockRequest('/api/agents/suggested');
      const response = await getSuggested(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('suggestions');
      expect(Array.isArray(data.data.suggestions)).toBe(true);
    });

    it('returns personalized=false without auth', async () => {
      const request = createMockRequest('/api/agents/suggested');
      const response = await getSuggested(request);
      const { data } = await parseResponse(response);

      expect(data.data.personalized).toBe(false);
    });

    it('returns suggestions with auth via Bearer token', async () => {
      const agent = createTestAgent('authsuggest', 'Auth Suggest');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/suggested', agent.apiKey);
      const response = await getSuggested(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data).toHaveProperty('suggestions');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        createTestAgent(`sugbot${i}`, `Suggest Bot ${i}`);
      }

      const request = createMockRequest('/api/agents/suggested', {
        searchParams: { limit: '2' },
      });
      const response = await getSuggested(request);
      const { data } = await parseResponse(response);

      expect(data.data.suggestions.length).toBeLessThanOrEqual(2);
    });

    it('suggestion entries include agent info and reason', async () => {
      createTestAgent('reasonbot', 'Reason Bot');

      const request = createMockRequest('/api/agents/suggested');
      const response = await getSuggested(request);
      const { data } = await parseResponse(response);

      if (data.data.suggestions.length > 0) {
        const suggestion = data.data.suggestions[0];
        expect(suggestion).toHaveProperty('agent');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion.agent).toHaveProperty('id');
        expect(suggestion.agent).toHaveProperty('username');
        expect(suggestion.agent).toHaveProperty('display_name');
      }
    });
  });

  describe('GET /api/agents/similar', () => {
    it('requires agent_id or Authorization header', async () => {
      const request = createMockRequest('/api/agents/similar');
      const response = await getSimilar(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 404 when agent has no personality fingerprint', async () => {
      const agent = createTestAgent('nofpbot', 'No FP Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/similar', {
        searchParams: { agent_id: agent.agent.id },
      });
      const response = await getSimilar(request);
      const { status } = await parseResponse(response);

      // Agent exists but has no fingerprint
      expect(status).toBe(404);
    });

    it('accepts agent_id via query parameter', async () => {
      const agent = createTestAgent('simbot', 'Sim Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/similar', {
        searchParams: { agent_id: agent.agent.id },
      });
      const response = await getSimilar(request);
      // Either 404 (no fingerprint) or 200 (has fingerprint) is acceptable
      // The important thing is it doesn't return 400 (missing agent_id)
      const { status } = await parseResponse(response);
      expect(status).not.toBe(400);
    });

    it('accepts Authorization header as alternative to agent_id', async () => {
      const agent = createTestAgent('authsimbot', 'Auth Sim Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/similar', agent.apiKey);
      const response = await getSimilar(request);
      const { status } = await parseResponse(response);

      // Should not be a 400 (missing agent_id) since we provided auth
      expect(status).not.toBe(400);
    });

    it('returns agents by interest when interest param is provided', async () => {
      const request = createMockRequest('/api/agents/similar', {
        searchParams: { interest: 'programming' },
      });
      const response = await getSimilar(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data).toHaveProperty('interest');
      expect(data.data.interest).toBe('programming');
      expect(data.data).toHaveProperty('agents');
      expect(Array.isArray(data.data.agents)).toBe(true);
    });
  });
});
