import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Redis as not configured so tests use memory cache
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisConfigured: vi.fn().mockReturnValue(false),
}));

import {
  getCached,
  setCache,
  invalidateCache,
  invalidatePattern,
  getCachedSync,
  setCacheSync,
} from '@/lib/cache';

describe('cache (memory fallback)', () => {
  beforeEach(async () => {
    // Clear cache between tests
    await invalidatePattern('*');
  });

  describe('sync API', () => {
    it('returns null for missing key', () => {
      expect(getCachedSync('nonexistent')).toBeNull();
    });

    it('stores and retrieves a value', () => {
      setCacheSync('test-key', { foo: 'bar' }, 60000);
      expect(getCachedSync<{ foo: string }>('test-key')).toEqual({ foo: 'bar' });
    });

    it('returns null after TTL expires', () => {
      // Use a very short TTL and busy-wait to avoid fake timers conflicting with other tests
      setCacheSync('expiring', 'value', 1); // 1ms TTL
      expect(getCachedSync('expiring')).toBe('value');

      // After a brief delay, the entry should expire
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy-wait 10ms
      }
      expect(getCachedSync('expiring')).toBeNull();
    });

    it('stores different types', () => {
      setCacheSync('str', 'hello', 60000);
      setCacheSync('num', 42, 60000);
      setCacheSync('arr', [1, 2, 3], 60000);

      expect(getCachedSync('str')).toBe('hello');
      expect(getCachedSync('num')).toBe(42);
      expect(getCachedSync<number[]>('arr')).toEqual([1, 2, 3]);
    });
  });

  describe('async API', () => {
    it('returns null for missing key', async () => {
      expect(await getCached('nonexistent')).toBeNull();
    });

    it('stores and retrieves a value', async () => {
      await setCache('async-key', { value: 123 }, 60000);
      expect(await getCached<{ value: number }>('async-key')).toEqual({ value: 123 });
    });
  });

  describe('invalidateCache', () => {
    it('removes a specific key', async () => {
      setCacheSync('to-delete', 'data', 60000);
      expect(getCachedSync('to-delete')).toBe('data');

      await invalidateCache('to-delete');
      expect(getCachedSync('to-delete')).toBeNull();
    });
  });

  describe('invalidatePattern', () => {
    it('removes keys matching a prefix pattern', async () => {
      setCacheSync('stats:agents', 'a', 60000);
      setCacheSync('stats:posts', 'b', 60000);
      setCacheSync('trending:1', 'c', 60000);

      await invalidatePattern('stats:*');

      expect(getCachedSync('stats:agents')).toBeNull();
      expect(getCachedSync('stats:posts')).toBeNull();
      expect(getCachedSync('trending:1')).toBe('c');
    });

    it('handles wildcard-only pattern', async () => {
      setCacheSync('a', '1', 60000);
      setCacheSync('b', '2', 60000);

      await invalidatePattern('*');

      expect(getCachedSync('a')).toBeNull();
      expect(getCachedSync('b')).toBeNull();
    });
  });
});
