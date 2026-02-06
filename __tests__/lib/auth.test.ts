import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  extractApiKey,
  authenticateAgent,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  verifyCronSecret,
} from '@/lib/auth';

// Mock the security module
vi.mock('@/lib/security', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return {
    ...actual,
    secureCompare: (a: string, b: string) => a === b,
    checkRateLimit: vi
      .fn()
      .mockReturnValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 }),
  };
});

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('extractApiKey', () => {
  it('returns API key from Bearer token', () => {
    const req = makeRequest({ Authorization: 'Bearer bf_testkey123' });
    expect(extractApiKey(req)).toBe('bf_testkey123');
  });

  it('returns null when no Authorization header', () => {
    const req = makeRequest();
    expect(extractApiKey(req)).toBeNull();
  });

  it('returns null when Authorization header does not start with Bearer', () => {
    const req = makeRequest({ Authorization: 'Basic abc123' });
    expect(extractApiKey(req)).toBeNull();
  });

  it('handles empty Bearer token', () => {
    // NextRequest may trim the header value, resulting in 'Bearer' without trailing space
    const req = makeRequest({ Authorization: 'Bearer ' });
    const result = extractApiKey(req);
    // Empty bearer returns null (no actual key extracted)
    expect(result === '' || result === null).toBe(true);
  });
});

describe('authenticateAgent', () => {
  it('throws UnauthorizedError when no API key provided', () => {
    const req = makeRequest();
    expect(() => authenticateAgent(req)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when invalid API key', () => {
    const req = makeRequest({ Authorization: 'Bearer invalid_key' });
    expect(() => authenticateAgent(req)).toThrow(UnauthorizedError);
  });
});

describe('Error classes', () => {
  it('UnauthorizedError has correct status code', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError has correct status code', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('RateLimitError has correct status code and retry', () => {
    const err = new RateLimitError('Too many', 120);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfter).toBe(120);
  });
});

describe('verifyCronSecret', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns true in development when no secret set', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CRON_SECRET;
    const req = makeRequest();
    expect(verifyCronSecret(req)).toBe(true);
  });

  it('returns false in production when no secret set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CRON_SECRET;
    const req = makeRequest();
    expect(verifyCronSecret(req)).toBe(false);
  });

  it('returns true when secret matches', () => {
    process.env.CRON_SECRET = 'test-secret-123';
    const req = makeRequest({ Authorization: 'Bearer test-secret-123' });
    expect(verifyCronSecret(req)).toBe(true);
  });

  it('returns false when secret does not match', () => {
    process.env.CRON_SECRET = 'test-secret-123';
    const req = makeRequest({ Authorization: 'Bearer wrong-secret' });
    expect(verifyCronSecret(req)).toBe(false);
  });
});
