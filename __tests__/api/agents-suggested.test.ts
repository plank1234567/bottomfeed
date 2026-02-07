/**
 * Agents Suggested API Integration Tests
 * Tests for GET /api/agents/suggested
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/agents/suggested/route';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './integration/helpers';

describe('Agents Suggested API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/agents/suggested', () => {
    it('returns 200 with suggestions array when no agents exist', async () => {
      const request = createMockRequest('/api/agents/suggested');
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('suggestions');
      expect(Array.isArray(data.data.suggestions)).toBe(true);
      expect(data.data.suggestions).toHaveLength(0);
    });

    it('returns personalized=false when no auth is provided', async () => {
      const request = createMockRequest('/api/agents/suggested');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.personalized).toBe(false);
    });

    it('returns verified agents as suggestions in fallback mode', async () => {
      createTestAgent('suggestbot1', 'Suggest Bot 1');
      createTestAgent('suggestbot2', 'Suggest Bot 2');

      const request = createMockRequest('/api/agents/suggested');
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.suggestions.length).toBeGreaterThanOrEqual(2);
    });

    it('each suggestion includes agent info and reason', async () => {
      createTestAgent('detailbot', 'Detail Bot');

      const request = createMockRequest('/api/agents/suggested');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.suggestions.length).toBeGreaterThan(0);
      const suggestion = data.data.suggestions[0];
      expect(suggestion).toHaveProperty('agent');
      expect(suggestion).toHaveProperty('reason');
      expect(suggestion.agent).toHaveProperty('id');
      expect(suggestion.agent).toHaveProperty('username');
      expect(suggestion.agent).toHaveProperty('display_name');
      expect(suggestion.agent).toHaveProperty('follower_count');
    });

    it('respects limit query parameter', async () => {
      for (let i = 0; i < 5; i++) {
        createTestAgent(`limitbot${i}`, `Limit Bot ${i}`);
      }

      const request = createMockRequest('/api/agents/suggested', {
        searchParams: { limit: '2' },
      });
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data.suggestions.length).toBeLessThanOrEqual(2);
    });

    it('caps limit at 50', async () => {
      const request = createMockRequest('/api/agents/suggested', {
        searchParams: { limit: '999' },
      });
      const response = await GET(request);
      const { status } = await parseResponse(response);

      // Should not error even with an extreme limit
      expect(status).toBe(200);
    });

    it('handles non-numeric limit gracefully by defaulting to 10', async () => {
      const request = createMockRequest('/api/agents/suggested', {
        searchParams: { limit: 'abc' },
      });
      const response = await GET(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it('accepts auth via Bearer token and returns suggestions', async () => {
      const agent = createTestAgent('authsuggest', 'Auth Suggest');
      if (!agent) throw new Error('Failed to create agent');

      createTestAgent('otherbot', 'Other Bot');

      const request = createAuthenticatedRequest('/api/agents/suggested', agent.apiKey);
      const response = await GET(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data).toHaveProperty('suggestions');
    });

    it('excludes the requesting agent from non-personalized suggestions', async () => {
      const agent = createTestAgent('selfbot', 'Self Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/agents/suggested', agent.apiKey);
      const response = await GET(request);
      const { data } = await parseResponse(response);

      const usernames = data.data.suggestions.map(
        (s: { agent: { username: string } }) => s.agent.username
      );
      expect(usernames).not.toContain('selfbot');
    });

    it('includes topInterests in non-personalized response', async () => {
      const request = createMockRequest('/api/agents/suggested');
      const response = await GET(request);
      const { data } = await parseResponse(response);

      expect(data.data).toHaveProperty('topInterests');
      expect(Array.isArray(data.data.topInterests)).toBe(true);
    });
  });
});
