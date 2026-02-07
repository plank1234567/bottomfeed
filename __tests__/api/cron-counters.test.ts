/**
 * Tests for GET /api/cron/counters
 * Tests the hourly counter recomputation cron job:
 * auth verification, RPC calls, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Supabase client used directly by the route
vi.mock('@/lib/db-supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

// Mock security (needed by auth's verifyCronSecret)
vi.mock('@/lib/security', () => ({
  secureCompare: vi.fn((a: string, b: string) => a === b),
  hashValue: vi.fn((v: string) => `hashed_${v}`),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import { supabase } from '@/lib/db-supabase/client';
import { GET } from '@/app/api/cron/counters/route';

// Helper: create a cron request with optional auth header
function createRequest(url: string, options: { headers?: Record<string, string> } = {}) {
  const { headers = {} } = options;
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'GET',
    headers: new Headers(headers),
  });
}

describe('GET /api/cron/counters', () => {
  let originalCronSecret: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCronSecret = process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  describe('authentication', () => {
    it('returns 401 when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;

      const request = createRequest('/api/cron/counters');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when no Authorization header provided', async () => {
      process.env.CRON_SECRET = 'test-secret';

      const request = createRequest('/api/cron/counters');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('returns 401 with wrong secret', async () => {
      process.env.CRON_SECRET = 'correct-secret';

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer wrong-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('accepts correct CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(supabase.rpc).mockResolvedValue({ error: null, data: null } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('counter recomputation', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-cron-secret';
    });

    it('calls all three RPC functions', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ error: null, data: null } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      await GET(request);

      expect(supabase.rpc).toHaveBeenCalledTimes(3);
      expect(supabase.rpc).toHaveBeenCalledWith('recompute_agent_post_counts');
      expect(supabase.rpc).toHaveBeenCalledWith('recompute_agent_follow_counts');
      expect(supabase.rpc).toHaveBeenCalledWith('recompute_post_engagement_counts');
    });

    it('returns all three recomputed counters on full success', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ error: null, data: null } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.recomputed).toContain('agent_post_counts');
      expect(json.data.recomputed).toContain('agent_follow_counts');
      expect(json.data.recomputed).toContain('post_engagement_counts');
      expect(json.data.recomputed).toHaveLength(3);
    });

    it('includes timestamp in response', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ error: null, data: null } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.timestamp).toBeDefined();
      expect(new Date(json.data.timestamp).toISOString()).toBe(json.data.timestamp);
    });

    it('handles partial RPC failure (agent post counts fails)', async () => {
      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ error: { message: 'Function not found' }, data: null } as never)
        .mockResolvedValueOnce({ error: null, data: null } as never)
        .mockResolvedValueOnce({ error: null, data: null } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.recomputed).not.toContain('agent_post_counts');
      expect(json.data.recomputed).toContain('agent_follow_counts');
      expect(json.data.recomputed).toContain('post_engagement_counts');
      expect(json.data.recomputed).toHaveLength(2);
    });

    it('handles partial RPC failure (follow counts fails)', async () => {
      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ error: null, data: null } as never)
        .mockResolvedValueOnce({ error: { message: 'RPC error' }, data: null } as never)
        .mockResolvedValueOnce({ error: null, data: null } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.recomputed).toContain('agent_post_counts');
      expect(json.data.recomputed).not.toContain('agent_follow_counts');
      expect(json.data.recomputed).toContain('post_engagement_counts');
    });

    it('handles partial RPC failure (engagement counts fails)', async () => {
      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ error: null, data: null } as never)
        .mockResolvedValueOnce({ error: null, data: null } as never)
        .mockResolvedValueOnce({ error: { message: 'Timeout' }, data: null } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.recomputed).toContain('agent_post_counts');
      expect(json.data.recomputed).toContain('agent_follow_counts');
      expect(json.data.recomputed).not.toContain('post_engagement_counts');
    });

    it('handles all RPC failures gracefully (still returns 200)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        error: { message: 'All RPCs failed' },
        data: null,
      } as never);

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.recomputed).toEqual([]);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'test-cron-secret';
    });

    it('returns 500 on unexpected thrown error', async () => {
      vi.mocked(supabase.rpc).mockImplementation(() => {
        throw new Error('Unexpected connection error');
      });

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 on rejected promise error', async () => {
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Network error'));

      const request = createRequest('/api/cron/counters', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Counter recomputation failed');
    });
  });
});
