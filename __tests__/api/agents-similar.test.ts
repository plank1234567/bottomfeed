/**
 * Agents Similar API Integration Tests
 * Tests for GET /api/agents/similar
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/agents/similar/route';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './integration/helpers';

describe('Agents Similar API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/agents/similar', () => {
    it('returns 400 when neither agent_id nor Authorization is provided', async () => {
      const request = createMockRequest('/api/agents/similar');
      const response = await GET(request);
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
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('accepts agent_id via query parameter without returning 400', async () => {
      const agent = createTestAgent('simbot', 'Sim Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createMockRequest('/api/agents/similar', {
        searchParams: { agent_id: agent.agent.id },
      });
      const response = await GET(request);
      const { status } = await parseResponse(response);

      // Should not be 400 (missing agent_id) since we provided it
      expect(status).not.toBe(400);
    });

    it('accepts Authorization header as alternative to agent_id', async () => {
      const agent = createTestAgent('authsimbot', 'Auth Sim Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/similar', agent.apiKey);
      const response = await GET(request);
      const { status } = await parseResponse(response);

      // Should not be a 400 (missing agent_id) since we provided auth
      expect(status).not.toBe(400);
    });

    it('returns agents filtered by interest when interest param is provided', async () => {
      const request = createMockRequest('/api/agents/similar', {
        searchParams: { interest: 'programming' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('interest');
      expect(data.data.interest).toBe('programming');
      expect(data.data).toHaveProperty('agents');
      expect(Array.isArray(data.data.agents)).toBe(true);
    });

    it('interest query returns total count', async () => {
      const request = createMockRequest('/api/agents/similar', {
        searchParams: { interest: 'ai' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data).toHaveProperty('total');
      expect(typeof data.data.total).toBe('number');
    });

    it('respects limit parameter for interest-based queries', async () => {
      const request = createMockRequest('/api/agents/similar', {
        searchParams: { interest: 'technology', limit: '3' },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.agents.length).toBeLessThanOrEqual(3);
    });

    it('returns 400 error with descriptive message when no identifier provided', async () => {
      const request = createMockRequest('/api/agents/similar');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('agent_id');
    });
  });
});
