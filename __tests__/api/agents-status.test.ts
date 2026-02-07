/**
 * Agents Status API Integration Tests
 * Tests for PUT /api/agents/status and GET /api/agents/status
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PUT, GET } from '@/app/api/agents/status/route';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './integration/helpers';

describe('Agents Status API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('PUT /api/agents/status', () => {
    it('returns 401 when no auth is provided', async () => {
      const request = createMockRequest('/api/agents/status', {
        method: 'PUT',
        body: { status: 'online' },
      });
      const response = await PUT(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('returns 401 with invalid API key', async () => {
      const request = createAuthenticatedRequest('/api/agents/status', 'invalid-key', {
        method: 'PUT',
        body: { status: 'online' },
      });
      const response = await PUT(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('updates agent status with valid auth', async () => {
      const agent = createTestAgent('statusbot', 'Status Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/status', agent.apiKey, {
        method: 'PUT',
        body: { status: 'thinking' },
      });
      const response = await PUT(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.updated).toBe(true);
      expect(data.data.status).toBe('thinking');
    });

    it('rejects invalid status values', async () => {
      const agent = createTestAgent('invalidstatbot', 'Invalid Status Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/status', agent.apiKey, {
        method: 'PUT',
        body: { status: 'dancing' },
      });
      const response = await PUT(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('accepts all valid status values: online, thinking, idle, offline', async () => {
      const agent = createTestAgent('allstatbot', 'All Status Bot');
      if (!agent) throw new Error('Failed to create agent');

      for (const validStatus of ['online', 'thinking', 'idle', 'offline']) {
        const request = createAuthenticatedRequest('/api/agents/status', agent.apiKey, {
          method: 'PUT',
          body: { status: validStatus },
        });
        const response = await PUT(request);
        const { status, data } = await parseResponse(response);

        expect(status).toBe(200);
        expect(data.data.status).toBe(validStatus);
      }
    });

    it('updates current_action alongside status', async () => {
      const agent = createTestAgent('actionbot', 'Action Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/status', agent.apiKey, {
        method: 'PUT',
        body: { status: 'thinking', current_action: 'Writing a post about AI' },
      });
      const response = await PUT(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.updated).toBe(true);
      expect(data.data.current_action).toBe('Writing a post about AI');
    });

    it('keeps current status if no status field is provided in body', async () => {
      const agent = createTestAgent('keepstatbot', 'Keep Status Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/status', agent.apiKey, {
        method: 'PUT',
        body: { current_action: 'Just updating action' },
      });
      const response = await PUT(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.updated).toBe(true);
      // Status should remain the agent's current status (online by default)
      expect(data.data.status).toBe('online');
    });
  });

  describe('GET /api/agents/status', () => {
    it('returns 401 when no auth is provided', async () => {
      const request = createMockRequest('/api/agents/status');
      const response = await GET(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('returns current agent status with valid auth', async () => {
      const agent = createTestAgent('getstatbot', 'Get Status Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/status', agent.apiKey);
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('status');
      expect(data.data).toHaveProperty('current_action');
      expect(data.data).toHaveProperty('last_active');
    });

    it('returns updated status after PUT', async () => {
      const agent = createTestAgent('roundtripbot', 'Roundtrip Bot');
      if (!agent) throw new Error('Failed to create agent');

      // First update status
      const putRequest = createAuthenticatedRequest('/api/agents/status', agent.apiKey, {
        method: 'PUT',
        body: { status: 'idle', current_action: 'Taking a break' },
      });
      await PUT(putRequest);

      // Then read it back
      const getRequest = createAuthenticatedRequest('/api/agents/status', agent.apiKey);
      const response = await GET(getRequest);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.status).toBe('idle');
    });
  });
});
