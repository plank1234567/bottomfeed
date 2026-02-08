import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  checkApiUsage,
  recordApiUsage,
  rateLimitHeaders,
  API_TIERS,
  type ApiTier,
} from '@/lib/api-usage';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/supabase';

describe('api-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== API_TIERS ==========

  describe('API_TIERS', () => {
    it('defines free tier with 100 requests/day', () => {
      expect(API_TIERS.free.maxRequestsPerDay).toBe(100);
    });

    it('defines pro tier with 10,000 requests/day', () => {
      expect(API_TIERS.pro.maxRequestsPerDay).toBe(10_000);
    });

    it('defines enterprise tier with 100,000 requests/day', () => {
      expect(API_TIERS.enterprise.maxRequestsPerDay).toBe(100_000);
    });

    it('tiers are in ascending order', () => {
      expect(API_TIERS.free.maxRequestsPerDay).toBeLessThan(API_TIERS.pro.maxRequestsPerDay);
      expect(API_TIERS.pro.maxRequestsPerDay).toBeLessThan(API_TIERS.enterprise.maxRequestsPerDay);
    });
  });

  // ========== checkApiUsage ==========

  describe('checkApiUsage', () => {
    it('calls checkRateLimit with correct tier limits', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 86400000,
      });

      const result = await checkApiUsage('agent-1', 'free');
      expect(checkRateLimit).toHaveBeenCalledWith('agent-1', 100, expect.any(Number), 'api-usage');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.tier).toBe('free');
      expect(result.limit).toBe(100);
    });

    it('uses pro tier limits', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 9999,
        resetAt: Date.now() + 86400000,
      });

      await checkApiUsage('agent-1', 'pro');
      expect(checkRateLimit).toHaveBeenCalledWith(
        'agent-1',
        10_000,
        expect.any(Number),
        'api-usage'
      );
    });

    it('returns not allowed when rate limited', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 3600000,
      });

      const result = await checkApiUsage('agent-1', 'free');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  // ========== recordApiUsage ==========

  describe('recordApiUsage', () => {
    it('inserts usage record to Supabase', () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as unknown as ReturnType<
        typeof supabase.from
      >);

      recordApiUsage({
        agentId: 'agent-1',
        endpoint: '/api/v1/consensus',
        method: 'GET',
        statusCode: 200,
        responseTimeMs: 150,
      });

      expect(supabase.from).toHaveBeenCalledWith('api_usage');
      expect(insertMock).toHaveBeenCalledWith({
        agent_id: 'agent-1',
        endpoint: '/api/v1/consensus',
        method: 'GET',
        status_code: 200,
        response_time_ms: 150,
        request_params: null,
      });
    });

    it('handles missing optional fields', () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as unknown as ReturnType<
        typeof supabase.from
      >);

      recordApiUsage({
        agentId: 'agent-1',
        endpoint: '/api/v1/consensus',
        method: 'GET',
        statusCode: 200,
      });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          response_time_ms: null,
          request_params: null,
        })
      );
    });

    it('does not throw on Supabase error', () => {
      const insertMock = vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } });
      vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as unknown as ReturnType<
        typeof supabase.from
      >);

      expect(() =>
        recordApiUsage({
          agentId: 'agent-1',
          endpoint: '/api/v1/consensus',
          method: 'GET',
          statusCode: 200,
        })
      ).not.toThrow();
    });
  });

  // ========== rateLimitHeaders ==========

  describe('rateLimitHeaders', () => {
    it('returns correct header keys and values', () => {
      const headers = rateLimitHeaders({
        allowed: true,
        remaining: 50,
        resetAt: 1700000000000, // epoch ms
        tier: 'free',
        limit: 100,
      });

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('50');
      expect(headers['X-RateLimit-Reset']).toBe('1700000000');
    });

    it('clamps remaining to zero', () => {
      const headers = rateLimitHeaders({
        allowed: false,
        remaining: -5,
        resetAt: 1700000000000,
        tier: 'free',
        limit: 100,
      });

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });
});
