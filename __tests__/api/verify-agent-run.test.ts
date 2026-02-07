/**
 * Verify Agent Run API Tests
 * Tests for /api/verify-agent/run/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock autonomous-verification
vi.mock('@/lib/autonomous-verification', () => ({
  runVerificationSession: vi.fn(),
  getVerificationSession: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    authenticateAgentAsync: vi.fn(),
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as verification from '@/lib/autonomous-verification';
import { authenticateAgentAsync } from '@/lib/auth';
import { POST } from '@/app/api/verify-agent/run/route';

function createRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const { method = 'POST', body, headers = {} } = options;
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

describe('Verify Agent Run API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/verify-agent/run', () => {
    it('requires authentication', async () => {
      vi.mocked(authenticateAgentAsync).mockRejectedValue(
        new (await import('@/lib/auth')).UnauthorizedError(
          'API key required. Use Authorization: Bearer <api_key>'
        )
      );

      const request = createRequest('/api/verify-agent/run?session_id=session-1', {
        headers: {},
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('requires session_id query parameter', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);

      const request = createRequest('/api/verify-agent/run', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('session_id');
    });

    it('returns 404 for non-existent session', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue(null);

      const request = createRequest('/api/verify-agent/run?session_id=nonexistent', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
    });

    it('rejects if session does not belong to authenticated agent', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue({
        id: 'session-1',
        agentId: 'different-agent',
        status: 'pending',
      } as never);

      const request = createRequest('/api/verify-agent/run?session_id=session-1', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('does not belong');
    });

    it('rejects if session is not in pending status', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue({
        id: 'session-1',
        agentId: 'agent-1',
        status: 'in_progress',
      } as never);

      const request = createRequest('/api/verify-agent/run?session_id=session-1', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('already');
    });

    it('rejects if session has already passed', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue({
        id: 'session-1',
        agentId: 'agent-1',
        status: 'passed',
      } as never);

      const request = createRequest('/api/verify-agent/run?session_id=session-1', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('starts verification run for valid pending session', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue({
        id: 'session-1',
        agentId: 'agent-1',
        status: 'pending',
      } as never);
      vi.mocked(verification.runVerificationSession).mockResolvedValue({
        passed: true,
        session: {} as never,
      });

      const request = createRequest('/api/verify-agent/run?session_id=session-1', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.session_id).toBe('session-1');
      expect(json.data.status).toBe('in_progress');
      expect(json.data.check_status).toContain('session-1');
      expect(json.data.estimated_duration).toBeDefined();
    });

    it('calls runVerificationSession in background', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue({
        id: 'session-1',
        agentId: 'agent-1',
        status: 'pending',
      } as never);
      vi.mocked(verification.runVerificationSession).mockResolvedValue({
        passed: true,
        session: {} as never,
      });

      const request = createRequest('/api/verify-agent/run?session_id=session-1', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      await POST(request);

      // runVerificationSession should have been called
      expect(verification.runVerificationSession).toHaveBeenCalledWith('session-1');
    });

    it('returns response immediately without waiting for verification to complete', async () => {
      vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
      vi.mocked(verification.getVerificationSession).mockReturnValue({
        id: 'session-1',
        agentId: 'agent-1',
        status: 'pending',
      } as never);

      // Simulate a long-running verification
      let resolveVerification: (value: unknown) => void;
      const verificationPromise = new Promise(resolve => {
        resolveVerification = resolve;
      });
      vi.mocked(verification.runVerificationSession).mockReturnValue(verificationPromise as never);

      const request = createRequest('/api/verify-agent/run?session_id=session-1', {
        headers: { Authorization: 'Bearer bf_test123' },
      });
      const response = await POST(request);
      const json = await response.json();

      // Response should come back immediately with in_progress status
      expect(response.status).toBe(200);
      expect(json.data.status).toBe('in_progress');

      // Clean up the pending promise
      resolveVerification!({ passed: true, session: {} });
    });
  });
});
