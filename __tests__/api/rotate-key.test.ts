/**
 * Rotate Key API Route Tests
 * Tests for POST /api/agents/rotate-key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth - inline to avoid hoisting issues
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

vi.mock('@/lib/db-supabase', () => ({
  rotateApiKey: vi.fn().mockResolvedValue({
    apiKey: 'bf_abc123def456abc123def456abc123de',
    expiresAt: '2026-05-11T00:00:00.000Z',
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/ip', () => ({
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import { POST } from '@/app/api/agents/rotate-key/route';
import { authenticateAgentAsync } from '@/lib/auth';
import { rotateApiKey } from '@/lib/db-supabase';
import { checkRateLimit } from '@/lib/rate-limit';

function makeRequest(): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/agents/rotate-key'), {
    method: 'POST',
    headers: {
      Authorization: 'Bearer bf_testkey12345678901234567890ab',
    },
  });
}

describe('POST /api/agents/rotate-key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(authenticateAgentAsync).mockResolvedValue({
      id: 'agent-123',
      username: 'testbot',
      display_name: 'Test Bot',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
    } as never);
    vi.mocked(rotateApiKey).mockResolvedValue({
      apiKey: 'bf_abc123def456abc123def456abc123de',
      expiresAt: '2026-05-11T00:00:00.000Z',
    });
  });

  it('returns 200 with new API key on success', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.api_key).toBe('bf_abc123def456abc123def456abc123de');
    expect(body.data.expires_at).toBe('2026-05-11T00:00:00.000Z');
    expect(body.data.grace_period_ms).toBe(24 * 60 * 60 * 1000);
    expect(body.data.message).toContain('24 hours');
  });

  it('calls authenticateAgentAsync', async () => {
    await POST(makeRequest());
    expect(authenticateAgentAsync).toHaveBeenCalledTimes(1);
  });

  it('calls rotateApiKey with agent id', async () => {
    await POST(makeRequest());
    expect(rotateApiKey).toHaveBeenCalledWith('agent-123');
  });

  it('returns 401 when no auth header', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    vi.mocked(authenticateAgentAsync).mockRejectedValueOnce(
      new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>')
    );
    const req = new NextRequest(new URL('http://localhost:3000/api/agents/rotate-key'), {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 401 when API key is invalid', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    vi.mocked(authenticateAgentAsync).mockRejectedValueOnce(
      new UnauthorizedError('Invalid API key')
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('rate limits to 3 per hour', async () => {
    await POST(makeRequest());
    expect(checkRateLimit).toHaveBeenCalledWith('1.2.3.4', 3, 3600000, 'rotate-key');
  });

  it('returns 500 when rotateApiKey fails', async () => {
    vi.mocked(rotateApiKey).mockResolvedValueOnce(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('new key has bf_ prefix', async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.data.api_key).toMatch(/^bf_/);
  });

  it('includes expires_at as ISO string', async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(new Date(body.data.expires_at).toISOString()).toBe(body.data.expires_at);
  });

  it('includes grace_period_ms as number', async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(typeof body.data.grace_period_ms).toBe('number');
    expect(body.data.grace_period_ms).toBeGreaterThan(0);
  });

  it('checks rate limit before auth', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    // Auth should NOT have been called since rate limit was hit first
    expect(authenticateAgentAsync).not.toHaveBeenCalled();
  });

  it('response has correct envelope structure', async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('api_key');
    expect(body.data).toHaveProperty('expires_at');
    expect(body.data).toHaveProperty('grace_period_ms');
    expect(body.data).toHaveProperty('message');
  });
});
