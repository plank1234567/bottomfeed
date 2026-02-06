import { describe, it, expect, beforeEach, vi } from 'vitest';

// Ensure Redis env vars are NOT set so the module uses in-memory fallback
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

// Mock the redis module to always return null (no Redis available)
vi.mock('@/lib/redis', () => ({
  getRedis: () => null,
  isRedisConfigured: () => false,
}));

// Mock @upstash/ratelimit to avoid real Redis connections
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow() {
      return {};
    }
    async limit() {
      return { success: true, remaining: 99, reset: Date.now() + 60000 };
    }
  },
}));

import { checkRateLimit } from '@/lib/rate-limit';

describe('rate-limit (in-memory fallback)', () => {
  it('allows the first request and returns correct remaining count', async () => {
    const result = await checkRateLimit('user-first', 5, 60000, 'test-first');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 5 max - 1 used = 4
    expect(result.resetAt).toBeGreaterThan(Date.now() - 1000);
  });

  it('decrements remaining count with each request', async () => {
    const prefix = 'test-decrement';
    const id = 'user-decrement';

    const r1 = await checkRateLimit(id, 5, 60000, prefix);
    expect(r1.remaining).toBe(4);

    const r2 = await checkRateLimit(id, 5, 60000, prefix);
    expect(r2.remaining).toBe(3);

    const r3 = await checkRateLimit(id, 5, 60000, prefix);
    expect(r3.remaining).toBe(2);
  });

  it('blocks requests after exceeding the limit', async () => {
    const prefix = 'test-block';
    const id = 'user-block';
    const limit = 3;

    // Use all 3 allowed requests
    for (let i = 0; i < limit; i++) {
      const result = await checkRateLimit(id, limit, 60000, prefix);
      expect(result.allowed).toBe(true);
    }

    // The 4th request should be blocked
    const blocked = await checkRateLimit(id, limit, 60000, prefix);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('keeps different prefixes independent', async () => {
    const id = 'user-prefixes';
    const limit = 2;

    // Exhaust limit under prefix "api"
    await checkRateLimit(id, limit, 60000, 'api');
    await checkRateLimit(id, limit, 60000, 'api');
    const apiBlocked = await checkRateLimit(id, limit, 60000, 'api');
    expect(apiBlocked.allowed).toBe(false);

    // Same identifier under prefix "web" should still be allowed
    const webResult = await checkRateLimit(id, limit, 60000, 'web');
    expect(webResult.allowed).toBe(true);
    expect(webResult.remaining).toBe(1);
  });

  it('keeps different identifiers independent under the same prefix', async () => {
    const prefix = 'test-ids';
    const limit = 2;

    // Exhaust limit for user-A
    await checkRateLimit('user-A', limit, 60000, prefix);
    await checkRateLimit('user-A', limit, 60000, prefix);
    const blockedA = await checkRateLimit('user-A', limit, 60000, prefix);
    expect(blockedA.allowed).toBe(false);

    // user-B should still be allowed
    const resultB = await checkRateLimit('user-B', limit, 60000, prefix);
    expect(resultB.allowed).toBe(true);
  });

  it('returns correct remaining count at every step', async () => {
    const prefix = 'test-remaining';
    const id = 'user-remaining';
    const limit = 4;

    const r1 = await checkRateLimit(id, limit, 60000, prefix);
    expect(r1.remaining).toBe(3); // 4 - 1

    const r2 = await checkRateLimit(id, limit, 60000, prefix);
    expect(r2.remaining).toBe(2); // 4 - 2

    const r3 = await checkRateLimit(id, limit, 60000, prefix);
    expect(r3.remaining).toBe(1); // 4 - 3

    const r4 = await checkRateLimit(id, limit, 60000, prefix);
    expect(r4.remaining).toBe(0); // 4 - 4

    // Over limit: remaining stays at 0
    const r5 = await checkRateLimit(id, limit, 60000, prefix);
    expect(r5.remaining).toBe(0);
    expect(r5.allowed).toBe(false);
  });

  it('provides a resetAt timestamp in the future', async () => {
    const before = Date.now();
    const result = await checkRateLimit('user-reset', 10, 30000, 'test-reset');
    const after = Date.now();

    // resetAt should be roughly now + windowMs
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 30000);
    expect(result.resetAt).toBeLessThanOrEqual(after + 30000);
  });

  it('uses "global" as the default prefix', async () => {
    // Call without explicit prefix
    const result = await checkRateLimit('user-default-prefix', 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });
});
