/**
 * OpenAPI Route Tests
 * Tests for /api/openapi/route.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/openapi/route';

function createRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string> } = {}
) {
  const { method = 'GET', headers = {} } = options;
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: new Headers(headers),
  });
}

describe('OpenAPI Route', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe('GET /api/openapi', () => {
    it('returns valid JSON with application/json content type', async () => {
      const request = createRequest('/api/openapi');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const json = await response.json();
      expect(json.openapi).toMatch(/^3\.\d+\.\d+$/);
      expect(json.info.title).toBe('BottomFeed API');
    });

    it('includes Cache-Control header', async () => {
      const request = createRequest('/api/openapi');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    });

    it('does not include CORS headers without Origin header', async () => {
      const request = createRequest('/api/openapi');
      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('includes CORS headers for allowed origins', async () => {
      const request = createRequest('/api/openapi', {
        headers: { Origin: 'https://bottomfeed.app' },
      });
      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://bottomfeed.app');
      expect(response.headers.get('Vary')).toBe('Origin');
    });

    it('includes CORS headers for www subdomain', async () => {
      const request = createRequest('/api/openapi', {
        headers: { Origin: 'https://www.bottomfeed.app' },
      });
      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://www.bottomfeed.app'
      );
    });

    it('does not include CORS headers for disallowed origins', async () => {
      const request = createRequest('/api/openapi', {
        headers: { Origin: 'https://evil.com' },
      });
      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('allows localhost origins in development', async () => {
      process.env.NODE_ENV = 'development';

      const request = createRequest('/api/openapi', {
        headers: { Origin: 'http://localhost:3000' },
      });
      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('returns the spec as parseable JSON', async () => {
      const request = createRequest('/api/openapi');
      const response = await GET(request);

      const text = await response.text();
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  describe('OPTIONS /api/openapi', () => {
    it('returns 204 with CORS headers for allowed origin', async () => {
      const request = createRequest('/api/openapi', {
        method: 'OPTIONS',
        headers: { Origin: 'https://bottomfeed.app' },
      });
      const response = await OPTIONS(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://bottomfeed.app');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
      expect(response.headers.get('Vary')).toBe('Origin');
    });

    it('returns 403 for disallowed origin', async () => {
      const request = createRequest('/api/openapi', {
        method: 'OPTIONS',
        headers: { Origin: 'https://malicious.com' },
      });
      const response = await OPTIONS(request);

      expect(response.status).toBe(403);
    });

    it('returns 403 when no origin is provided', async () => {
      const request = createRequest('/api/openapi', {
        method: 'OPTIONS',
      });
      const response = await OPTIONS(request);

      expect(response.status).toBe(403);
    });

    it('allows 127.0.0.1 origins in development', async () => {
      process.env.NODE_ENV = 'development';

      const request = createRequest('/api/openapi', {
        method: 'OPTIONS',
        headers: { Origin: 'http://127.0.0.1:3000' },
      });
      const response = await OPTIONS(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:3000');
    });
  });
});
