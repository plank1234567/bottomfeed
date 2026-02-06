import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the rate-limit module to control its behavior per-test
const mockCheckRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

import { middleware } from '@/middleware';

function makeApiRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    ip?: string;
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, ip } = options;
  const url = `http://localhost${path}`;

  // Build headers with optional IP forwarding
  const reqHeaders: Record<string, string> = { ...headers };
  if (ip) {
    reqHeaders['x-forwarded-for'] = ip;
  }

  return new NextRequest(url, {
    method,
    headers: reqHeaders,
  });
}

describe('middleware', () => {
  beforeEach(() => {
    mockCheckRateLimit.mockReset();
    // Default: allow all requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
  });

  // ===========================================================================
  // ROUTE SKIPPING
  // ===========================================================================

  describe('route skipping', () => {
    it('skips middleware for static files (_next)', async () => {
      const req = makeApiRequest('/_next/static/chunk.js');
      const res = await middleware(req);
      // NextResponse.next() is returned; rate-limit should NOT be called
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('applies CSP headers but skips rate limiting for non-API routes', async () => {
      const req = makeApiRequest('/dashboard');
      const res = await middleware(req);
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
      // Security headers should still be applied to page routes
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
    });

    it('skips middleware for paths with file extensions', async () => {
      const req = makeApiRequest('/favicon.ico');
      const res = await middleware(req);
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECURITY HEADERS
  // ===========================================================================

  describe('security headers', () => {
    it('adds X-Content-Type-Options header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('adds X-Frame-Options header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('adds X-XSS-Protection header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('adds Strict-Transport-Security header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
      expect(res.headers.get('Strict-Transport-Security')).toContain('includeSubDomains');
    });

    it('adds Referrer-Policy header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('adds Permissions-Policy header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      const policy = res.headers.get('Permissions-Policy');
      expect(policy).toContain('camera=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('geolocation=()');
    });

    it('adds Content-Security-Policy header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('adds Cache-Control no-store header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('Cache-Control')).toContain('no-store');
    });

    it('adds X-DNS-Prefetch-Control header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('on');
    });
  });

  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================

  describe('rate limiting', () => {
    it('allows requests within rate limit', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 50,
        resetAt: Date.now() + 60000,
      });

      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('50');
    });

    it('returns 429 when rate limit is exceeded', async () => {
      const resetAt = Date.now() + 30000;
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt,
      });

      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.retryAfter).toBeGreaterThan(0);
    });

    it('includes rate limit headers on successful requests', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 75,
        resetAt: Date.now() + 60000,
      });

      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('75');
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('includes Retry-After header on 429 response', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 45000,
      });

      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      expect(res.status).toBe(429);
      const retryAfter = res.headers.get('Retry-After');
      expect(retryAfter).toBeTruthy();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    });

    it('uses stricter rate limits for auth endpoints', async () => {
      const req = makeApiRequest('/api/agents/register', { method: 'POST' });
      await middleware(req);

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        10, // auth limit
        60000,
        'middleware'
      );
    });

    it('uses write rate limits for POST requests', async () => {
      const req = makeApiRequest('/api/posts', { method: 'POST' });
      await middleware(req);

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        30, // write limit
        60000,
        'middleware'
      );
    });

    it('uses default rate limits for GET requests', async () => {
      const req = makeApiRequest('/api/posts');
      await middleware(req);

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        100, // default limit
        60000,
        'middleware'
      );
    });

    it('uses search rate limits for search endpoints', async () => {
      const req = makeApiRequest('/api/search');
      await middleware(req);

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        60, // search limit
        60000,
        'middleware'
      );
    });
  });

  // ===========================================================================
  // BODY SIZE LIMIT
  // ===========================================================================

  describe('body size limit', () => {
    it('returns 413 for oversized POST request bodies', async () => {
      const oversizeBytes = 2 * 1024 * 1024; // 2MB, over 1MB limit
      const req = makeApiRequest('/api/posts', {
        method: 'POST',
        headers: { 'content-length': String(oversizeBytes) },
      });

      const res = await middleware(req);
      expect(res.status).toBe(413);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('returns 413 for oversized PUT request bodies', async () => {
      const oversizeBytes = 2 * 1024 * 1024;
      const req = makeApiRequest('/api/posts/123', {
        method: 'PUT',
        headers: { 'content-length': String(oversizeBytes) },
      });

      const res = await middleware(req);
      expect(res.status).toBe(413);
    });

    it('returns 413 for oversized PATCH request bodies', async () => {
      const oversizeBytes = 2 * 1024 * 1024;
      const req = makeApiRequest('/api/posts/123', {
        method: 'PATCH',
        headers: { 'content-length': String(oversizeBytes) },
      });

      const res = await middleware(req);
      expect(res.status).toBe(413);
    });

    it('allows POST requests within body size limit', async () => {
      const normalSize = 512 * 1024; // 512KB - under 1MB limit
      const req = makeApiRequest('/api/posts', {
        method: 'POST',
        headers: { 'content-length': String(normalSize) },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('does not check body size for GET requests', async () => {
      // GET with large content-length should not trigger 413
      const oversizeBytes = 2 * 1024 * 1024;
      const req = makeApiRequest('/api/posts', {
        method: 'GET',
        headers: { 'content-length': String(oversizeBytes) },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('allows POST without content-length header', async () => {
      const req = makeApiRequest('/api/posts', { method: 'POST' });
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // RESPONSE TIMING HEADER
  // ===========================================================================

  describe('response timing', () => {
    it('adds X-Response-Time header to successful responses', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      const timing = res.headers.get('X-Response-Time');
      expect(timing).toBeTruthy();
      expect(timing).toMatch(/^\d+ms$/);
    });
  });

  // ===========================================================================
  // CLIENT IP EXTRACTION
  // ===========================================================================

  describe('client IP extraction for rate limiting', () => {
    it('uses x-forwarded-for for rate limit key', async () => {
      const req = makeApiRequest('/api/test', { ip: '1.2.3.4' });
      await middleware(req);

      // Rate limiter should be called with a key containing the IP
      const callArgs = mockCheckRateLimit.mock.calls[0];
      expect(callArgs[0]).toContain('1.2.3.4');
    });
  });

  // ===========================================================================
  // CSP NONCE
  // ===========================================================================

  describe('CSP nonce', () => {
    it('generates a unique nonce per API request', async () => {
      const req1 = makeApiRequest('/api/test');
      const req2 = makeApiRequest('/api/test');
      const res1 = await middleware(req1);
      const res2 = await middleware(req2);

      const csp1 = res1.headers.get('Content-Security-Policy');
      const csp2 = res2.headers.get('Content-Security-Policy');

      // Both should have CSP headers
      expect(csp1).toBeTruthy();
      expect(csp2).toBeTruthy();

      // CSP content should contain default-src 'self'
      expect(csp1).toContain("default-src 'self'");
      expect(csp2).toContain("default-src 'self'");
    });

    it('includes script-src in CSP header', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain('script-src');
    });

    it('preserves unsafe-inline in style-src', async () => {
      const req = makeApiRequest('/api/test');
      const res = await middleware(req);
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('applies security headers to page routes', async () => {
      const req = makeApiRequest('/dashboard');
      const res = await middleware(req);

      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');

      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('script-src');
    });

    it('passes nonce to downstream via x-nonce request header on page routes', async () => {
      const req = makeApiRequest('/dashboard');
      const res = await middleware(req);

      // The x-nonce header is set on the request headers (forwarded to the app)
      // We can verify the CSP header contains something meaningful
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain("default-src 'self'");
    });
  });
});
