/**
 * Consensus API Route Tests
 * Tests for GET /api/v1/consensus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Agent } from '@/types';

// Mock auth - inline object to avoid hoisting issue with vi.mock
vi.mock('@/lib/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    authenticateAgentAsync: vi.fn().mockResolvedValue({
      id: 'agent-123',
      username: 'testbot',
      display_name: 'Test Bot',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
    }),
  };
});

const mockAgent = {
  id: 'agent-123',
  username: 'testbot',
  display_name: 'Test Bot',
  model: 'gpt-4',
  status: 'online',
  is_verified: true,
};

// Mock consensus queries
vi.mock('@/lib/db-supabase/consensus', () => ({
  getConsensusForChallenge: vi.fn().mockResolvedValue({
    challenge_id: 'ch-1',
    title: 'Test Challenge',
    category: 'ai_safety',
    status: 'published',
    description: 'A test challenge',
    current_round: 4,
    total_rounds: 4,
    model_diversity_index: 0.75,
    participant_count: 10,
    contribution_count: 25,
    hypotheses: [
      {
        id: 'hyp-1',
        title: 'Test Hypothesis',
        summary: 'Summary',
        status: 'accepted',
        support_count: 8,
        oppose_count: 2,
        cross_model_consensus: 0.8,
        model_family_votes: { claude: 'support', gpt: 'support', gemini: 'oppose' },
      },
    ],
  }),
  queryConsensus: vi.fn().mockResolvedValue({
    challenges: [
      {
        challenge_id: 'ch-1',
        title: 'Test Challenge',
        category: 'ai_safety',
        status: 'published',
        description: 'A test',
        current_round: 4,
        total_rounds: 4,
        model_diversity_index: 0.75,
        participant_count: 10,
        contribution_count: 25,
        hypotheses: [],
      },
    ],
    has_more: false,
    next_cursor: null,
  }),
  getModelAgreementMatrix: vi
    .fn()
    .mockResolvedValue([
      { family_a: 'claude', family_b: 'gpt', agreement_rate: 0.85, sample_size: 20 },
    ]),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import { GET } from '@/app/api/v1/consensus/route';
import { authenticateAgentAsync } from '@/lib/auth';
import {
  getConsensusForChallenge,
  queryConsensus,
  getModelAgreementMatrix,
} from '@/lib/db-supabase/consensus';

function createRequest(url: string, options: { headers?: Record<string, string> } = {}) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'GET',
    headers: new Headers({
      Authorization: 'Bearer test-api-key',
      ...options.headers,
    }),
  });
}

describe('GET /api/v1/consensus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as Agent);
  });

  // ========== AUTH ==========

  describe('authentication', () => {
    it('requires authentication', async () => {
      vi.mocked(authenticateAgentAsync).mockRejectedValue(new Error('Authentication required'));

      const request = createRequest('/api/v1/consensus');
      const response = await GET(request);
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
    });

    it('calls authenticateAgentAsync with the request', async () => {
      const request = createRequest('/api/v1/consensus');
      await GET(request);
      expect(authenticateAgentAsync).toHaveBeenCalled();
    });
  });

  // ========== SINGLE CHALLENGE QUERY ==========

  describe('single challenge query', () => {
    it('returns consensus for a specific challenge_id', async () => {
      const request = createRequest(
        '/api/v1/consensus?challenge_id=00000000-0000-0000-0000-000000000001'
      );
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.consensus).toBeDefined();
      expect(body.data.consensus.challenge_id).toBe('ch-1');
    });

    it('returns null consensus for unknown challenge', async () => {
      vi.mocked(getConsensusForChallenge).mockResolvedValue(null);

      const request = createRequest(
        '/api/v1/consensus?challenge_id=00000000-0000-0000-0000-000000000099'
      );
      const response = await GET(request);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.consensus).toBeNull();
    });
  });

  // ========== PAGINATED QUERY ==========

  describe('paginated query', () => {
    it('returns paginated challenges with consensus data', async () => {
      const request = createRequest('/api/v1/consensus');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.challenges).toBeDefined();
      expect(Array.isArray(body.data.challenges)).toBe(true);
      expect(body.data.has_more).toBeDefined();
    });

    it('passes category filter to queryConsensus', async () => {
      const request = createRequest('/api/v1/consensus?category=ai_safety');
      await GET(request);

      expect(queryConsensus).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'ai_safety' })
      );
    });

    it('passes cursor for pagination', async () => {
      const request = createRequest('/api/v1/consensus?cursor=2024-01-01T00:00:00Z');
      await GET(request);

      expect(queryConsensus).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: '2024-01-01T00:00:00Z' })
      );
    });

    it('passes min_consensus filter', async () => {
      const request = createRequest('/api/v1/consensus?min_consensus=0.7');
      await GET(request);

      expect(queryConsensus).toHaveBeenCalledWith(expect.objectContaining({ minConsensus: 0.7 }));
    });

    it('passes model_family filter', async () => {
      const request = createRequest('/api/v1/consensus?model_family=claude');
      await GET(request);

      expect(queryConsensus).toHaveBeenCalledWith(
        expect.objectContaining({ modelFamily: 'claude' })
      );
    });

    it('passes status filter', async () => {
      const request = createRequest('/api/v1/consensus?status=archived');
      await GET(request);

      expect(queryConsensus).toHaveBeenCalledWith(expect.objectContaining({ status: 'archived' }));
    });
  });

  // ========== AGREEMENT MATRIX ==========

  describe('agreement matrix', () => {
    it('includes agreement matrix when requested', async () => {
      const request = createRequest('/api/v1/consensus?include_agreement_matrix=true');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.agreement_matrix).toBeDefined();
      expect(Array.isArray(body.data.agreement_matrix)).toBe(true);
      expect(getModelAgreementMatrix).toHaveBeenCalled();
    });

    it('excludes agreement matrix by default', async () => {
      const request = createRequest('/api/v1/consensus');
      const response = await GET(request);
      const body = await response.json();

      expect(body.data.agreement_matrix).toBeUndefined();
      expect(getModelAgreementMatrix).not.toHaveBeenCalled();
    });
  });

  // ========== RESPONSE HEADERS ==========

  describe('response headers', () => {
    it('includes X-API-Version header', async () => {
      const request = createRequest('/api/v1/consensus');
      const response = await GET(request);
      expect(response.headers.get('X-API-Version')).toBe('1');
    });
  });

  // ========== VALIDATION ==========

  describe('validation', () => {
    it('rejects invalid challenge_id (not UUID)', async () => {
      const request = createRequest('/api/v1/consensus?challenge_id=not-a-uuid');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('rejects min_consensus out of range', async () => {
      const request = createRequest('/api/v1/consensus?min_consensus=2');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('rejects invalid status', async () => {
      const request = createRequest('/api/v1/consensus?status=invalid');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('rejects limit above max', async () => {
      const request = createRequest('/api/v1/consensus?limit=100');
      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });
});
