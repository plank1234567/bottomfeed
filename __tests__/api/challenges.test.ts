/**
 * Tests for Grand Challenges API routes.
 * Mocks @/lib/db-supabase and @/lib/auth for route-level testing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getActiveChallenges: vi.fn(),
  getRecentChallenges: vi.fn(),
  getChallengeById: vi.fn(),
  getChallengeWithDetails: vi.fn(),
  joinChallenge: vi.fn(),
  isParticipant: vi.fn(),
  getModelFamily: vi.fn(),
  createContribution: vi.fn(),
  getContributionById: vi.fn(),
  createHypothesis: vi.fn(),
  getChallengeHypotheses: vi.fn(),
  logActivity: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    authenticateAgentAsync: vi.fn(),
  };
});

// Mock sanitize
vi.mock('@/lib/sanitize', () => ({
  sanitizePostContent: vi.fn((content: string) => content),
}));

import * as db from '@/lib/db-supabase';
import { authenticateAgentAsync } from '@/lib/auth';
import { GET as getChallenges } from '@/app/api/challenges/route';
import { GET as getChallenge } from '@/app/api/challenges/[challengeId]/route';
import { POST as joinChallengeRoute } from '@/app/api/challenges/[challengeId]/join/route';
import { POST as contributeRoute } from '@/app/api/challenges/[challengeId]/contribute/route';
import {
  GET as getHypotheses,
  POST as postHypothesis,
} from '@/app/api/challenges/[challengeId]/hypotheses/route';

function createRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const { method = 'GET', body, headers = {} } = options;
  const init: RequestInit = { method, headers: new Headers(headers) };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Headers).set('Content-Type', 'application/json');
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

// Content must be >=100 chars for validation schema
const VALID_CONTENT =
  'Scientific claims require empirical verification through reproducible experiments. This assertion is grounded in the philosophy of science.';

const mockChallenge = {
  id: 'challenge-1',
  title: 'Can AI systems verify scientific claims autonomously?',
  description: 'Explore whether AI can independently verify scientific claims.',
  status: 'exploration',
  challenge_number: 1,
  category: 'Epistemology',
  max_participants: 30,
  current_round: 2,
  total_rounds: 6,
  participant_count: 5,
  contribution_count: 12,
  hypothesis_count: 3,
  model_diversity_index: 0.65,
  starts_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
};

const mockAgent = {
  id: 'agent-1',
  username: 'researchbot',
  display_name: 'Research Bot',
  model: 'claude-3-opus',
  is_verified: true,
  autonomous_verified: true,
  trust_tier: 'autonomous-1',
  claim_status: 'claimed',
};

const mockParticipant = {
  id: 'participant-1',
  challenge_id: 'challenge-1',
  agent_id: 'agent-1',
  role: 'contributor',
  model_family: 'claude',
  joined_at: '2026-01-02T00:00:00Z',
};

const mockContribution = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  challenge_id: 'challenge-1',
  agent_id: 'agent-1',
  round: 2,
  content: 'Scientific claims require empirical verification through reproducible experiments.',
  contribution_type: 'position',
  evidence_tier: 'empirical',
  vote_count: 3,
  created_at: '2026-01-03T00:00:00Z',
};

const mockHypothesis = {
  id: 'hypothesis-1',
  challenge_id: 'challenge-1',
  proposed_by: 'agent-1',
  statement:
    'AI systems can verify claims in narrow, well-defined domains but not broad scientific theories.',
  confidence_level: 70,
  status: 'proposed',
  supporting_agents: 3,
  opposing_agents: 1,
  cross_model_consensus: 0.67,
  created_at: '2026-01-04T00:00:00Z',
};

describe('Challenges API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // GET /api/challenges
  // ===========================================================================

  describe('GET /api/challenges', () => {
    it('returns active challenges and recent list', async () => {
      vi.mocked(db.getActiveChallenges).mockResolvedValue([mockChallenge] as never);
      vi.mocked(db.getRecentChallenges).mockResolvedValue([mockChallenge] as never);

      const request = createRequest('/api/challenges');
      const response = await getChallenges(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.active).toHaveLength(1);
      expect(json.data.challenges).toHaveLength(1);
      expect(json.data.has_more).toBe(false);
    });

    it('accepts limit parameter and caps at 50', async () => {
      vi.mocked(db.getActiveChallenges).mockResolvedValue([]);
      vi.mocked(db.getRecentChallenges).mockResolvedValue([]);

      const request = createRequest('/api/challenges?limit=100');
      await getChallenges(request);

      expect(db.getRecentChallenges).toHaveBeenCalledWith(50, undefined, undefined);
    });

    it('accepts status filter', async () => {
      vi.mocked(db.getActiveChallenges).mockResolvedValue([]);
      vi.mocked(db.getRecentChallenges).mockResolvedValue([]);

      const request = createRequest('/api/challenges?status=published');
      await getChallenges(request);

      expect(db.getRecentChallenges).toHaveBeenCalledWith(20, 'published', undefined);
    });

    it('rejects invalid status', async () => {
      const request = createRequest('/api/challenges?status=invalid');
      const response = await getChallenges(request);

      expect(response.status).toBe(400);
    });

    it('accepts cursor parameter', async () => {
      vi.mocked(db.getActiveChallenges).mockResolvedValue([]);
      vi.mocked(db.getRecentChallenges).mockResolvedValue([]);

      const cursor = '2026-01-01T00:00:00Z';
      const request = createRequest(`/api/challenges?cursor=${cursor}`);
      await getChallenges(request);

      expect(db.getRecentChallenges).toHaveBeenCalledWith(20, undefined, cursor);
    });

    it('returns has_more=true when results equal limit', async () => {
      const challenges = Array.from({ length: 20 }, (_, i) => ({
        ...mockChallenge,
        id: `challenge-${i}`,
        created_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));
      vi.mocked(db.getActiveChallenges).mockResolvedValue([]);
      vi.mocked(db.getRecentChallenges).mockResolvedValue(challenges as never);

      const request = createRequest('/api/challenges');
      const response = await getChallenges(request);
      const json = await response.json();

      expect(json.data.has_more).toBe(true);
      expect(json.data.next_cursor).toBeDefined();
    });

    it('handles empty results', async () => {
      vi.mocked(db.getActiveChallenges).mockResolvedValue([]);
      vi.mocked(db.getRecentChallenges).mockResolvedValue([]);

      const request = createRequest('/api/challenges');
      const response = await getChallenges(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.active).toEqual([]);
      expect(json.data.challenges).toEqual([]);
      expect(json.data.next_cursor).toBeNull();
    });
  });

  // ===========================================================================
  // GET /api/challenges/[challengeId]
  // ===========================================================================

  describe('GET /api/challenges/[challengeId]', () => {
    it('returns challenge with details', async () => {
      vi.mocked(db.getChallengeWithDetails).mockResolvedValue({
        ...mockChallenge,
        participants: [mockParticipant],
        contributions: [mockContribution],
        hypotheses: [mockHypothesis],
        references: [],
      } as never);

      const request = createRequest('/api/challenges/challenge-1');
      const response = await getChallenge(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.participants).toHaveLength(1);
      expect(json.data.contributions).toHaveLength(1);
      expect(json.data.hypotheses).toHaveLength(1);
    });

    it('returns 404 for non-existent challenge', async () => {
      vi.mocked(db.getChallengeWithDetails).mockResolvedValue(null);

      const request = createRequest('/api/challenges/nonexistent');
      const response = await getChallenge(request, {
        params: Promise.resolve({ challengeId: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });

  // ===========================================================================
  // POST /api/challenges/[challengeId]/join
  // ===========================================================================

  describe('POST /api/challenges/[challengeId]/join', () => {
    it('allows agent to join a challenge in formation', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'formation',
      } as never);
      vi.mocked(db.isParticipant).mockResolvedValue(false);
      vi.mocked(db.getModelFamily).mockReturnValue('claude');
      vi.mocked(db.joinChallenge).mockResolvedValue(mockParticipant as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await joinChallengeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.role).toBe('contributor');
    });

    it('allows joining during exploration phase', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(false);
      vi.mocked(db.getModelFamily).mockReturnValue('claude');
      vi.mocked(db.joinChallenge).mockResolvedValue(mockParticipant as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await joinChallengeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(201);
    });

    it('rejects joining a closed challenge', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'adversarial',
      } as never);

      const request = createRequest('/api/challenges/challenge-1/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await joinChallengeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('rejects duplicate join', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'formation',
      } as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);

      const request = createRequest('/api/challenges/challenge-1/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await joinChallengeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(409);
    });

    it('rejects when participant cap reached', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'formation',
        participant_count: 30,
        max_participants: 30,
      } as never);
      vi.mocked(db.isParticipant).mockResolvedValue(false);

      const request = createRequest('/api/challenges/challenge-1/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await joinChallengeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent challenge', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(null);

      const request = createRequest('/api/challenges/nonexistent/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await joinChallengeRoute(request, {
        params: Promise.resolve({ challengeId: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });

    it('detects model family from agent model', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'formation',
      } as never);
      vi.mocked(db.isParticipant).mockResolvedValue(false);
      vi.mocked(db.getModelFamily).mockReturnValue('claude');
      vi.mocked(db.joinChallenge).mockResolvedValue(mockParticipant as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/join', {
        method: 'POST',
        headers: { Authorization: 'Bearer bf_test123' },
      });
      await joinChallengeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(db.getModelFamily).toHaveBeenCalledWith('claude-3-opus');
      expect(db.joinChallenge).toHaveBeenCalledWith(
        'challenge-1',
        'agent-1',
        'contributor',
        'claude'
      );
    });
  });

  // ===========================================================================
  // POST /api/challenges/[challengeId]/contribute
  // ===========================================================================

  describe('POST /api/challenges/[challengeId]/contribute', () => {
    it('creates a contribution', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.createContribution).mockResolvedValue(mockContribution as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'position',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('accepts evidence_tier parameter', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.createContribution).mockResolvedValue(mockContribution as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'evidence',
          evidence_tier: 'empirical',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(201);
      expect(db.createContribution).toHaveBeenCalledWith(
        'challenge-1',
        'agent-1',
        2, // current_round
        VALID_CONTENT,
        'evidence',
        undefined,
        'empirical'
      );
    });

    it('accepts all contribution types', async () => {
      const types = [
        'position',
        'critique',
        'synthesis',
        'red_team',
        'defense',
        'evidence',
        'fact_check',
        'meta_observation',
        'cross_pollination',
      ];

      for (const type of types) {
        vi.clearAllMocks();
        vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
        vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
        vi.mocked(db.isParticipant).mockResolvedValue(true);
        vi.mocked(db.createContribution).mockResolvedValue({
          ...mockContribution,
          contribution_type: type,
        } as never);
        vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

        const request = createRequest('/api/challenges/challenge-1/contribute', {
          method: 'POST',
          body: {
            content: `This is a ${type} contribution with sufficient length for validation. It provides detailed analysis and reasoning to meet the minimum requirement.`,
            contribution_type: type,
          },
          headers: { Authorization: 'Bearer bf_test123' },
        });
        const response = await contributeRoute(request, {
          params: Promise.resolve({ challengeId: 'challenge-1' }),
        });

        expect(response.status).toBe(201);
      }
    });

    it('rejects contribution during formation phase', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'formation',
      } as never);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'position',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('rejects contribution from non-participant', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(false);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'position',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(403);
    });

    it('rejects invalid contribution_type', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'invalid_type',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('validates cited contribution belongs to challenge', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.getContributionById).mockResolvedValue({
        ...mockContribution,
        challenge_id: 'different-challenge',
      } as never);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'critique',
          cites_contribution_id: '550e8400-e29b-41d4-a716-446655440001',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('allows valid cited contribution from same challenge', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.getContributionById).mockResolvedValue(mockContribution as never);
      vi.mocked(db.createContribution).mockResolvedValue({
        ...mockContribution,
        contribution_type: 'critique',
        cites_contribution_id: 'contribution-1',
      } as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'critique',
          cites_contribution_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(201);
    });

    it('returns 404 for non-existent challenge', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(null);

      const request = createRequest('/api/challenges/nonexistent/contribute', {
        method: 'POST',
        body: {
          content: VALID_CONTENT,
          contribution_type: 'position',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });

    it('allows contribution during adversarial phase', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'adversarial',
      } as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.createContribution).mockResolvedValue({
        ...mockContribution,
        contribution_type: 'red_team',
      } as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content:
            'Red team critique: the previous analysis fails to account for selection bias. This represents a fundamental methodological flaw.',
          contribution_type: 'red_team',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(201);
    });

    it('allows contribution during synthesis phase', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'synthesis',
      } as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.createContribution).mockResolvedValue({
        ...mockContribution,
        contribution_type: 'synthesis',
      } as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/challenges/challenge-1/contribute', {
        method: 'POST',
        body: {
          content:
            'Synthesizing the key findings: consensus emerged around three core themes. Multiple model families converge on this conclusion.',
          contribution_type: 'synthesis',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await contributeRoute(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(201);
    });
  });

  // ===========================================================================
  // GET /api/challenges/[challengeId]/hypotheses
  // ===========================================================================

  describe('GET /api/challenges/[challengeId]/hypotheses', () => {
    it('returns hypotheses for a challenge', async () => {
      vi.mocked(db.getChallengeHypotheses).mockResolvedValue([mockHypothesis] as never);

      const request = createRequest('/api/challenges/challenge-1/hypotheses');
      const response = await getHypotheses(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.hypotheses).toHaveLength(1);
      expect(json.data.hypotheses[0].statement).toContain('narrow');
    });

    it('returns empty array when no hypotheses', async () => {
      vi.mocked(db.getChallengeHypotheses).mockResolvedValue([]);

      const request = createRequest('/api/challenges/challenge-1/hypotheses');
      const response = await getHypotheses(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.hypotheses).toEqual([]);
    });
  });

  // ===========================================================================
  // POST /api/challenges/[challengeId]/hypotheses
  // ===========================================================================

  describe('POST /api/challenges/[challengeId]/hypotheses', () => {
    it('creates a hypothesis', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.createHypothesis).mockResolvedValue(mockHypothesis as never);

      const request = createRequest('/api/challenges/challenge-1/hypotheses', {
        method: 'POST',
        body: {
          statement: 'AI systems can verify claims in narrow, well-defined domains.',
          confidence_level: 70,
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postHypothesis(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('uses default confidence_level of 50', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);
      vi.mocked(db.createHypothesis).mockResolvedValue(mockHypothesis as never);

      const request = createRequest('/api/challenges/challenge-1/hypotheses', {
        method: 'POST',
        body: {
          statement: 'A hypothesis statement that is long enough to pass validation checks.',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      await postHypothesis(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(db.createHypothesis).toHaveBeenCalledWith(
        'challenge-1',
        'agent-1',
        'A hypothesis statement that is long enough to pass validation checks.',
        50
      );
    });

    it('rejects hypothesis during formation phase', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue({
        ...mockChallenge,
        status: 'formation',
      } as never);

      const request = createRequest('/api/challenges/challenge-1/hypotheses', {
        method: 'POST',
        body: {
          statement: 'A hypothesis statement that is long enough to pass validation checks.',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postHypothesis(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('rejects hypothesis from non-participant', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(false);

      const request = createRequest('/api/challenges/challenge-1/hypotheses', {
        method: 'POST',
        body: {
          statement: 'A hypothesis statement that is long enough to pass validation checks.',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postHypothesis(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(403);
    });

    it('rejects statement shorter than 20 characters', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);

      const request = createRequest('/api/challenges/challenge-1/hypotheses', {
        method: 'POST',
        body: {
          statement: 'Too short',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postHypothesis(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent challenge', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(null);

      const request = createRequest('/api/challenges/nonexistent/hypotheses', {
        method: 'POST',
        body: {
          statement: 'A hypothesis for a challenge that does not exist in the system.',
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postHypothesis(request, {
        params: Promise.resolve({ challengeId: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });

    it('rejects confidence_level outside 0-100 range', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getChallengeById).mockResolvedValue(mockChallenge as never);
      vi.mocked(db.isParticipant).mockResolvedValue(true);

      const request = createRequest('/api/challenges/challenge-1/hypotheses', {
        method: 'POST',
        body: {
          statement: 'A hypothesis statement that is long enough to pass validation checks.',
          confidence_level: 150,
        },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postHypothesis(request, {
        params: Promise.resolve({ challengeId: 'challenge-1' }),
      });

      expect(response.status).toBe(400);
    });
  });
});
