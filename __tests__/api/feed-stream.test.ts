/**
 * Feed Stream (SSE) API Tests
 * Tests for /api/feed/stream/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// We need to re-import the module for each test to reset module-level state
// The connection counters are module-level, so we use dynamic imports with vi.resetModules()
let GET: (request: NextRequest) => Promise<Response>;

function createSSERequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL('/api/feed/stream', 'http://localhost:3000'), {
    method: 'GET',
    headers: new Headers(headers),
  });
}

describe('Feed Stream API', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import the module to reset module-level connection counters
    vi.resetModules();
    // Re-register mocks after module reset (vi.doMock is the non-hoisted version)
    vi.doMock('@/lib/feed-pubsub', () => ({
      subscribeToNewPosts: vi.fn(() => vi.fn()),
    }));
    const mod = await import('@/app/api/feed/stream/route');
    GET = mod.GET;
  });

  describe('GET /api/feed/stream', () => {
    it('returns a response with correct SSE headers', async () => {
      const request = createSSERequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
      expect(response.headers.get('X-Accel-Buffering')).toBe('no');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('returns a readable stream in the response body', async () => {
      const request = createSSERequest();
      const response = await GET(request);

      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('sends an initial connected comment', async () => {
      const request = createSSERequest();
      const response = await GET(request);

      const reader = response.body!.getReader();
      const { value } = await reader.read();
      reader.cancel();

      const text = new TextDecoder().decode(value);
      expect(text).toBe(': connected\n\n');
    });

    it('uses x-forwarded-for header for IP detection', async () => {
      const request = createSSERequest({
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      });
      const response = await GET(request);

      // Should succeed because this is a unique IP
      expect(response.status).toBe(200);
    });

    it('uses x-real-ip header as fallback for IP detection', async () => {
      const request = createSSERequest({
        'x-real-ip': '9.8.7.6',
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('returns 429 when per-IP connection limit is exceeded', async () => {
      // Open MAX_SSE_CONNECTIONS_PER_IP (5) connections from same IP
      const responses: Response[] = [];
      for (let i = 0; i < 5; i++) {
        const request = createSSERequest({
          'x-forwarded-for': '10.0.0.1',
        });
        const response = await GET(request);
        responses.push(response);
      }

      // All 5 should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      // The 6th connection from the same IP should be rejected
      const request = createSSERequest({
        'x-forwarded-for': '10.0.0.1',
      });
      const response = await GET(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error.message).toBe('Too many connections from this IP');
    });

    it('allows connections from different IPs independently', async () => {
      // Open connections from different IPs
      const request1 = createSSERequest({
        'x-forwarded-for': '192.168.1.1',
      });
      const response1 = await GET(request1);
      expect(response1.status).toBe(200);

      const request2 = createSSERequest({
        'x-forwarded-for': '192.168.1.2',
      });
      const response2 = await GET(request2);
      expect(response2.status).toBe(200);
    });

    it('returns 503 when total connection limit is exceeded', async () => {
      // Open MAX_SSE_CONNECTIONS_TOTAL (200) connections from unique IPs
      for (let i = 0; i < 200; i++) {
        // Generate unique IPs: 4 octets, each unique
        const a = Math.floor(i / 125);
        const b = Math.floor(i / 25) % 5;
        const c = Math.floor(i / 5) % 5;
        const d = (i % 5) + 1; // +1 to avoid 0.0.0.0
        const ip = `${a}.${b}.${c}.${d}`;
        const request = createSSERequest({
          'x-forwarded-for': ip,
        });
        const response = await GET(request);
        // Each IP appears at most once, so per-IP limit won't be hit
        expect(response.status).toBe(200);
      }

      // The 201st connection should be rejected
      const request = createSSERequest({
        'x-forwarded-for': '255.255.255.1',
      });
      const response = await GET(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error.message).toBe('Too many connections');
    });
  });
});
