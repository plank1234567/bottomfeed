/**
 * Verify Agent API Tests
 * Tests for /api/verify-agent/route.ts (GET and POST)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getAgentByApiKey: vi.fn(),
  getAgentById: vi.fn(),
  getPendingClaimByAgentId: vi.fn(),
}));

// Mock autonomous-verification
vi.mock('@/lib/autonomous-verification', () => ({
  startVerificationSession: vi.fn(),
  getVerificationSession: vi.fn(),
  getVerificationStatus: vi.fn(),
  isAgentVerified: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    authenticateAgentAsync: vi.fn(),
  };
});

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 }),
}));

// Mock safeFetch to delegate to global.fetch (avoids DNS resolution in tests)
vi.mock('@/lib/validation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/validation')>();
  return {
    ...actual,
    safeFetch: vi.fn((...args: Parameters<typeof fetch>) => global.fetch(...args)),
  };
});

import * as db from '@/lib/db-supabase';
import * as verification from '@/lib/autonomous-verification';
import { authenticateAgentAsync } from '@/lib/auth';
import { GET, POST } from '@/app/api/verify-agent/route';

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

describe('Verify Agent API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/verify-agent', () => {
    it('returns verification status by session_id', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);

      const mockSession = {
        id: 'session-1',
        agentId: 'agent-1',
        status: 'in_progress',
        currentDay: 1,
        startedAt: Date.now() - 60000,
        completedAt: null,
        failureReason: null,
        dailyChallenges: [
          {
            day: 1,
            challenges: [
              {
                type: 'factual',
                status: 'passed',
                sentAt: Date.now() - 30000,
                respondedAt: Date.now() - 28000,
                scheduledFor: Date.now() - 30000,
                failureReason: null,
              },
              {
                type: 'reasoning',
                status: 'pending',
                sentAt: null,
                respondedAt: null,
                scheduledFor: Date.now() + 60000,
                failureReason: null,
              },
            ],
          },
        ],
      };

      vi.mocked(verification.getVerificationSession).mockReturnValue(mockSession as never);

      const request = createRequest('/api/verify-agent?session_id=session-1', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.session_id).toBe('session-1');
      expect(json.data.status).toBe('in_progress');
      expect(json.data.challenges).toBeDefined();
      expect(json.data.challenges.total).toBe(2);
      expect(json.data.challenges.passed).toBe(1);
      expect(json.data.challenges.pending).toBe(1);
    });

    it('returns 400 for non-existent session_id', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue(null);

      const request = createRequest('/api/verify-agent?session_id=nonexistent', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('returns verification status by agent_id', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);

      const mockStatus = {
        verified: true,
        verifiedAt: Date.now() - 86400000,
        spotChecksPassed: 5,
      };

      vi.mocked(verification.getVerificationStatus).mockReturnValue(mockStatus as never);

      const request = createRequest('/api/verify-agent', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.verified).toBe(true);
    });

    it('returns verification status via Authorization header', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationStatus).mockReturnValue({
        verified: true,
        verifiedAt: Date.now(),
      } as never);

      const request = createRequest('/api/verify-agent', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.agent_id).toBe('agent-1');
      expect(json.data.username).toBe('testbot');
    });

    it('returns 401 when no auth provided', async () => {
      vi.mocked(authenticateAgentAsync).mockRejectedValue(
        new (await import('@/lib/auth')).UnauthorizedError(
          'API key required. Use Authorization: Bearer <api_key>'
        )
      );

      const request = createRequest('/api/verify-agent');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('includes claim info when session status is passed', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);

      const mockSession = {
        id: 'session-2',
        agentId: 'agent-1',
        status: 'passed',
        currentDay: 3,
        startedAt: Date.now() - 3 * 86400000,
        completedAt: Date.now() - 60000,
        failureReason: null,
        dailyChallenges: [],
      };

      vi.mocked(verification.getVerificationSession).mockReturnValue(mockSession as never);
      vi.mocked(db.getAgentById).mockResolvedValue({
        ...mockAgent,
        claim_status: 'unclaimed',
      } as never);
      vi.mocked(db.getPendingClaimByAgentId).mockResolvedValue({
        verification_code: 'reef-abc123',
      } as never);

      const request = createRequest('/api/verify-agent?session_id=session-2', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.claim).toBeDefined();
      expect(json.data.claim.claim_url).toBe('/claim/reef-abc123');
    });
  });

  describe('POST /api/verify-agent', () => {
    it('requires authentication', async () => {
      vi.mocked(authenticateAgentAsync).mockRejectedValue(
        new (await import('@/lib/auth')).UnauthorizedError(
          'API key required. Use Authorization: Bearer <api_key>'
        )
      );

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: { webhook_url: 'https://example.com/webhook' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('returns already_verified if agent is verified', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.isAgentVerified).mockReturnValue(true);
      vi.mocked(verification.getVerificationStatus).mockReturnValue({
        verified: true,
        verifiedAt: Date.now(),
      } as never);

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: { webhook_url: 'https://example.com/webhook' },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.already_verified).toBe(true);
    });

    it('returns validation error for missing webhook_url', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.isAgentVerified).mockReturnValue(false);

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: {},
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('returns validation error for invalid webhook_url', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.isAgentVerified).mockReturnValue(false);

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: { webhook_url: 'not-a-url' },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('tests webhook connectivity before starting session', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.isAgentVerified).mockReturnValue(false);

      // Mock global fetch to simulate webhook connectivity failure
      vi.mocked(global.fetch).mockRejectedValue(new Error('Connection refused'));

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: { webhook_url: 'https://example.com/webhook' },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Cannot connect to webhook URL');
    });

    it('returns error when webhook returns non-ok response', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.isAgentVerified).mockReturnValue(false);

      // Mock global fetch to simulate non-OK webhook response
      vi.mocked(global.fetch).mockResolvedValue(new Response('Server Error', { status: 500 }));

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: { webhook_url: 'https://example.com/webhook' },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Cannot reach webhook URL');
    });

    it('starts verification session when webhook is reachable', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.isAgentVerified).mockReturnValue(false);

      // Mock global fetch to simulate successful webhook connectivity
      vi.mocked(global.fetch).mockResolvedValue(new Response('OK', { status: 200 }));

      const mockSession = {
        id: 'session-new',
        agentId: 'agent-1',
        webhookUrl: 'https://example.com/webhook',
        status: 'pending',
        dailyChallenges: [
          {
            day: 1,
            challenges: [
              { type: 'factual', status: 'pending' },
              { type: 'reasoning', status: 'pending' },
              { type: 'creativity', status: 'pending' },
            ],
          },
          {
            day: 2,
            challenges: [
              { type: 'factual', status: 'pending' },
              { type: 'logic', status: 'pending' },
            ],
          },
        ],
      };

      vi.mocked(verification.startVerificationSession).mockReturnValue(mockSession as never);

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: { webhook_url: 'https://example.com/webhook' },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.session_id).toBe('session-new');
      expect(json.data.total_challenges).toBe(5);
      expect(json.data.verification_period).toBe('3 days');
      expect(json.data.instructions).toBeDefined();
      expect(Array.isArray(json.data.instructions)).toBe(true);
    });

    it('sends a ping to the webhook URL during connectivity check', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.isAgentVerified).mockReturnValue(false);

      vi.mocked(global.fetch).mockResolvedValue(new Response('OK', { status: 200 }));

      const mockSession = {
        id: 'session-ping',
        agentId: 'agent-1',
        status: 'pending',
        dailyChallenges: [{ day: 1, challenges: [] }],
      };
      vi.mocked(verification.startVerificationSession).mockReturnValue(mockSession as never);

      const request = createRequest('/api/verify-agent', {
        method: 'POST',
        body: { webhook_url: 'https://my-webhook.com/hook' },
        headers: { Authorization: 'Bearer bf_test123' },
      });
      await POST(request);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://my-webhook.com/hook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'ping', message: 'Testing connectivity' }),
        })
      );
    });
  });
});
