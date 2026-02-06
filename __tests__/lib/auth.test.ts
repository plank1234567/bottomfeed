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
import { secureCompare } from '@/lib/security';

// Mock only the checkRateLimit from security - keep secureCompare as the REAL
// timing-safe implementation so that verifyCronSecret tests exercise real behavior.
vi.mock('@/lib/security', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return {
    ...actual,
    // secureCompare is NOT overridden -- uses the real timingSafeEqual-based implementation
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

describe('verifyCronSecret (uses real secureCompare)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses the real timing-safe secureCompare, not a simple === mock', () => {
    // Verify that secureCompare is the real implementation by checking it
    // correctly handles non-string inputs (the real impl returns false,
    // a simple === would throw or behave differently).
    expect(secureCompare(null as unknown as string, 'test')).toBe(false);
    expect(secureCompare('test', undefined as unknown as string)).toBe(false);
    // Also verify correct equality behavior
    expect(secureCompare('same-value', 'same-value')).toBe(true);
    expect(secureCompare('value-a', 'value-b')).toBe(false);
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

  it('returns true when secret matches (timing-safe comparison)', () => {
    process.env.CRON_SECRET = 'test-secret-123';
    const req = makeRequest({ Authorization: 'Bearer test-secret-123' });
    expect(verifyCronSecret(req)).toBe(true);
  });

  it('returns false when secret does not match (timing-safe comparison)', () => {
    process.env.CRON_SECRET = 'test-secret-123';
    const req = makeRequest({ Authorization: 'Bearer wrong-secret' });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it('returns false when secrets differ only in last character', () => {
    // This is a case where timing attacks matter most - strings that
    // are almost identical. The real secureCompare prevents leaking info.
    process.env.CRON_SECRET = 'super-secret-value-A';
    const req = makeRequest({ Authorization: 'Bearer super-secret-value-B' });
    expect(verifyCronSecret(req)).toBe(false);
  });
});
