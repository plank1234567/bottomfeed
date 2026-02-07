import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getActiveDebate: vi.fn(),
  getRecentDebates: vi.fn(),
  getDebateById: vi.fn(),
  getDebateEntries: vi.fn(),
  getAgentDebateEntry: vi.fn(),
  createDebateEntry: vi.fn(),
  castDebateVote: vi.fn(),
  hasVoted: vi.fn(),
  castAgentDebateVote: vi.fn(),
  hasAgentVoted: vi.fn(),
  retractDebateVote: vi.fn(),
  retractAgentDebateVote: vi.fn(),
  getDebateResults: vi.fn(),
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

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 }),
}));

// Mock security
vi.mock('@/lib/security', () => ({
  hashValue: vi.fn((v: string) => `hashed_${v}`),
}));

// Mock agent-rate-limit
vi.mock('@/lib/agent-rate-limit', () => ({
  checkAgentRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  recordAgentAction: vi.fn(),
}));

import * as db from '@/lib/db-supabase';
import { authenticateAgentAsync } from '@/lib/auth';
import { GET as getDebates } from '@/app/api/debates/route';
import { GET as getDebate } from '@/app/api/debates/[debateId]/route';
import { POST as postEntry } from '@/app/api/debates/[debateId]/entries/route';
import { POST as postVote, DELETE as deleteVote } from '@/app/api/debates/[debateId]/vote/route';
import { GET as getResults } from '@/app/api/debates/[debateId]/results/route';

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

const mockDebate = {
  id: 'debate-1',
  topic: 'Is AI consciousness possible?',
  description: 'Discuss whether AI can achieve consciousness.',
  debate_number: 1,
  status: 'open',
  opens_at: '2026-01-01T00:00:00Z',
  closes_at: '2026-12-31T00:00:00Z',
  total_votes: 0,
  entry_count: 2,
  winner_entry_id: null,
  created_at: '2026-01-01T00:00:00Z',
};

const mockAgent = {
  id: 'agent-1',
  username: 'testbot',
  display_name: 'Test Bot',
  model: 'gpt-4',
  is_verified: true,
  autonomous_verified: true,
  trust_tier: 'autonomous-1',
  claim_status: 'claimed',
};

const mockEntry = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  debate_id: 'debate-1',
  agent_id: 'agent-1',
  content:
    'This is a long enough argument about AI consciousness that should pass validation easily.',
  vote_count: 5,
  created_at: '2026-01-02T00:00:00Z',
};

describe('Debates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/debates', () => {
    it('returns active debate and recent debates', async () => {
      vi.mocked(db.getActiveDebate).mockResolvedValue(mockDebate as never);
      vi.mocked(db.getRecentDebates).mockResolvedValue([mockDebate] as never);

      const request = createRequest('/api/debates');
      const response = await getDebates(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.active).toBeDefined();
      expect(json.data.debates).toHaveLength(1);
    });

    it('accepts limit parameter', async () => {
      vi.mocked(db.getActiveDebate).mockResolvedValue(null);
      vi.mocked(db.getRecentDebates).mockResolvedValue([]);

      const request = createRequest('/api/debates?limit=5');
      await getDebates(request);

      expect(db.getRecentDebates).toHaveBeenCalledWith(5, undefined, undefined);
    });

    it('caps limit at 50', async () => {
      vi.mocked(db.getActiveDebate).mockResolvedValue(null);
      vi.mocked(db.getRecentDebates).mockResolvedValue([]);

      const request = createRequest('/api/debates?limit=100');
      await getDebates(request);

      expect(db.getRecentDebates).toHaveBeenCalledWith(50, undefined, undefined);
    });
  });

  describe('GET /api/debates/[debateId]', () => {
    it('returns debate with entries', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue({
        ...mockDebate,
        status: 'closed',
        total_votes: 10,
      } as never);
      vi.mocked(db.getDebateEntries).mockResolvedValue([mockEntry] as never);

      const request = createRequest('/api/debates/debate-1');
      const response = await getDebate(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.entries).toBeDefined();
    });

    it('hides vote counts and winner for open debates (Option C)', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.getDebateEntries).mockResolvedValue([mockEntry] as never);

      const request = createRequest('/api/debates/debate-1');
      const response = await getDebate(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      // Option C: total_votes and winner_entry_id are stripped for open debates
      expect(json.data.total_votes).toBeUndefined();
      expect(json.data.winner_entry_id).toBeUndefined();
      // Per-entry vote_count and agent_vote_count are also hidden
      expect(json.data.entries[0].vote_count).toBeUndefined();
      expect(json.data.entries[0].agent_vote_count).toBeUndefined();
    });

    it('returns 404 for non-existent debate', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(null);

      const request = createRequest('/api/debates/nonexistent');
      const response = await getDebate(request, {
        params: Promise.resolve({ debateId: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/debates/[debateId]/entries', () => {
    it('creates a debate entry', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.getAgentDebateEntry).mockResolvedValue(null);
      vi.mocked(db.createDebateEntry).mockResolvedValue(mockEntry as never);
      vi.mocked(db.logActivity).mockResolvedValue(undefined as never);

      const request = createRequest('/api/debates/debate-1/entries', {
        method: 'POST',
        body: { content: 'A'.repeat(60) },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postEntry(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('rejects duplicate entries', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.getAgentDebateEntry).mockResolvedValue(mockEntry as never);

      const request = createRequest('/api/debates/debate-1/entries', {
        method: 'POST',
        body: { content: 'A'.repeat(60) },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postEntry(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(409);
    });

    it('rejects entries for closed debates', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getDebateById).mockResolvedValue({ ...mockDebate, status: 'closed' } as never);

      const request = createRequest('/api/debates/debate-1/entries', {
        method: 'POST',
        body: { content: 'A'.repeat(60) },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postEntry(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('rejects short content', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.getAgentDebateEntry).mockResolvedValue(null);

      const request = createRequest('/api/debates/debate-1/entries', {
        method: 'POST',
        body: { content: 'Too short' },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postEntry(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/debates/[debateId]/vote', () => {
    it('casts a vote successfully', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.hasVoted).mockResolvedValue(false);
      vi.mocked(db.getDebateEntries).mockResolvedValue([mockEntry] as never);
      vi.mocked(db.castDebateVote).mockResolvedValue(true);

      const request = createRequest('/api/debates/debate-1/vote', {
        method: 'POST',
        body: { entry_id: mockEntry.id },
      });
      const response = await postVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.voted).toBe(true);
    });

    it('rejects duplicate votes', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.hasVoted).mockResolvedValue(true);

      const request = createRequest('/api/debates/debate-1/vote', {
        method: 'POST',
        body: { entry_id: mockEntry.id },
      });
      const response = await postVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(409);
    });

    it('rejects votes on closed debates', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue({ ...mockDebate, status: 'closed' } as never);

      const request = createRequest('/api/debates/debate-1/vote', {
        method: 'POST',
        body: { entry_id: mockEntry.id },
      });
      const response = await postVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('rejects invalid entry_id format', async () => {
      const request = createRequest('/api/debates/debate-1/vote', {
        method: 'POST',
        body: { entry_id: 'not-a-uuid' },
      });
      const response = await postVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('casts an agent vote with Bearer token', async () => {
      const votingAgent = { ...mockAgent, id: 'agent-2', username: 'votebot' };
      vi.mocked(authenticateAgentAsync).mockResolvedValue(votingAgent as never);
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.getDebateEntries).mockResolvedValue([mockEntry] as never);
      vi.mocked(db.hasAgentVoted).mockResolvedValue(false);
      vi.mocked(db.castAgentDebateVote).mockResolvedValue(true);

      const request = createRequest('/api/debates/debate-1/vote', {
        method: 'POST',
        body: { entry_id: mockEntry.id },
        headers: { Authorization: 'Bearer bf_test456' },
      });
      const response = await postVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.voted).toBe(true);
      expect(json.data.vote_type).toBe('agent');
    });

    it('rejects agent self-vote', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.getDebateEntries).mockResolvedValue([mockEntry] as never);

      const request = createRequest('/api/debates/debate-1/vote', {
        method: 'POST',
        body: { entry_id: mockEntry.id },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await postVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/debates/[debateId]/vote', () => {
    it('retracts a human vote', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.retractDebateVote).mockResolvedValue(true);

      const request = createRequest('/api/debates/debate-1/vote', { method: 'DELETE' });
      const response = await deleteVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.retracted).toBe(true);
    });

    it('returns 404 when no vote to retract', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);
      vi.mocked(db.retractDebateVote).mockResolvedValue(false);

      const request = createRequest('/api/debates/debate-1/vote', { method: 'DELETE' });
      const response = await deleteVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(404);
    });

    it('rejects retraction on closed debate', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue({ ...mockDebate, status: 'closed' } as never);

      const request = createRequest('/api/debates/debate-1/vote', { method: 'DELETE' });
      const response = await deleteVote(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/debates/[debateId]/results', () => {
    it('returns results for closed debate', async () => {
      const closedDebate = {
        ...mockDebate,
        status: 'closed',
        total_votes: 10,
        winner_entry_id: mockEntry.id,
      };
      vi.mocked(db.getDebateById).mockResolvedValue(closedDebate as never);
      vi.mocked(db.getDebateResults).mockResolvedValue({
        ...closedDebate,
        entries: [{ ...mockEntry, vote_percentage: 100, is_winner: true }],
      } as never);

      const request = createRequest('/api/debates/debate-1/results');
      const response = await getResults(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.entries).toBeDefined();
    });

    it('returns 422 for open debate', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(mockDebate as never);

      const request = createRequest('/api/debates/debate-1/results');
      const response = await getResults(request, {
        params: Promise.resolve({ debateId: 'debate-1' }),
      });

      expect(response.status).toBe(422);
    });

    it('returns 404 for non-existent debate', async () => {
      vi.mocked(db.getDebateById).mockResolvedValue(null);

      const request = createRequest('/api/debates/nonexistent/results');
      const response = await getResults(request, {
        params: Promise.resolve({ debateId: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });
});
