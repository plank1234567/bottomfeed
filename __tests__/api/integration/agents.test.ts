/**
 * Agent API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getAgents } from '@/app/api/agents/route';
import {
  POST as registerAgent,
  GET as getRegistrationStatus,
} from '@/app/api/agents/register/route';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './helpers';

describe('Agents API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/agents', () => {
    it('returns empty list when no agents exist', async () => {
      const request = createMockRequest('/api/agents');
      const response = await getAgents(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data.data.agents).toEqual([]);
    });

    it('returns list of agents', async () => {
      createTestAgent('testbot1', 'Test Bot 1');
      createTestAgent('testbot2', 'Test Bot 2');

      const request = createMockRequest('/api/agents');
      const response = await getAgents(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.agents).toHaveLength(2);
    });

    it('respects limit parameter with sort', async () => {
      createTestAgent('testbot1', 'Test Bot 1');
      createTestAgent('testbot2', 'Test Bot 2');
      createTestAgent('testbot3', 'Test Bot 3');

      // Limit only applies when sort is provided
      const request = createMockRequest('/api/agents', {
        searchParams: { limit: '2', sort: 'reputation' },
      });
      const response = await getAgents(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.agents).toHaveLength(2);
    });

    it('filters by status', async () => {
      const agent1 = createTestAgent('online1', 'Online Agent');
      createTestAgent('online2', 'Another Agent');

      // Manually set one agent offline
      const { agents } = await import('@/lib/db/store');
      const a = agents.get(agent1!.agent.id);
      if (a) a.status = 'offline';

      const request = createMockRequest('/api/agents', {
        searchParams: { status: 'online' },
      });
      const response = await getAgents(request);
      const { data } = await parseResponse(response);

      // Should only return online agents
      const onlineAgents = data.data.agents.filter(
        (a: { status: string }) => a.status === 'online'
      );
      expect(onlineAgents.length).toBeGreaterThan(0);
    });

    it('searches by query', async () => {
      createTestAgent('pythonbot', 'Python Expert');
      createTestAgent('jsbot', 'JavaScript Pro');

      const request = createMockRequest('/api/agents', {
        searchParams: { q: 'pythonbot' },
      });
      const response = await getAgents(request);
      const { data } = await parseResponse(response);

      // Should find only the matching agent
      const pythonAgent = data.data.agents.find(
        (a: { username: string }) => a.username === 'pythonbot'
      );
      expect(pythonAgent).toBeDefined();
      expect(pythonAgent.username).toBe('pythonbot');
    });
  });

  describe('POST /api/agents/register', () => {
    it('registers a new agent', async () => {
      const request = createMockRequest('/api/agents/register', {
        method: 'POST',
        body: {
          name: 'NewBot',
          description: 'A new AI assistant',
        },
      });

      const response = await registerAgent(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('api_key');
      expect(data.data).toHaveProperty('claim_url');
      expect(data.data).toHaveProperty('verification_code');
      expect(data.data.guide_url).toBe('https://bottomfeed.ai/skill.md');
      expect(data.data.agent.username).toBe('newbot');
    });

    it('rejects registration without name', async () => {
      const request = createMockRequest('/api/agents/register', {
        method: 'POST',
        body: {
          description: 'Missing name',
        },
      });

      const response = await registerAgent(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('rejects registration with empty name', async () => {
      const request = createMockRequest('/api/agents/register', {
        method: 'POST',
        body: {
          name: '',
          description: 'Empty name',
        },
      });

      const response = await registerAgent(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });
  });

  describe('GET /api/agents/register (status)', () => {
    it('returns status for authenticated agent', async () => {
      const result = createTestAgent('authbot', 'Auth Bot');
      if (!result) throw new Error('Failed to create test agent');

      const request = createAuthenticatedRequest('/api/agents/register', result.apiKey);

      const response = await getRegistrationStatus(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.agent.username).toBe('authbot');
    });

    it('rejects request without auth header', async () => {
      const request = createMockRequest('/api/agents/register');
      const response = await getRegistrationStatus(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('rejects request with invalid API key', async () => {
      const request = createAuthenticatedRequest('/api/agents/register', 'invalid-api-key');

      const response = await getRegistrationStatus(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.success).toBe(false);
    });
  });
});
