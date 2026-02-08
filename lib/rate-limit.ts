/**
 * Unified Rate Limiter with Upstash Redis + In-Memory Fallback
 *
 * Uses Upstash Ratelimit when Redis is configured (UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN environment variables). Falls back to an in-memory
 * Map when Redis is not available or when a Redis call fails, ensuring
 * graceful degradation.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './redis';
import { logger } from './logger';

// IN-MEMORY FALLBACK STORE

// Eviction uses Map insertion order (FIFO) — oldest entries are evicted first.
const memoryStore = new Map<string, { count: number; resetAt: number }>();
// 10k entries ≈ ~2MB. High enough to avoid false positives under normal load,
// low enough to prevent unbounded memory growth on a single serverless instance.
const MAX_MEMORY_ENTRIES = 10000;

// UPSTASH RATELIMIT INSTANCE CACHE

const rateLimiters = new Map<string, Ratelimit>();

function getOrCreateRatelimiter(
  prefix: string,
  maxRequests: number,
  windowMs: number
): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${prefix}:${maxRequests}:${windowMs}`;
  let limiter = rateLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      prefix: `rl:${prefix}`,
    });
    rateLimiters.set(key, limiter);
  }
  return limiter;
}

// IN-MEMORY RATE LIMIT CHECK

function memoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || record.resetAt <= now) {
    // Evict oldest entry if at capacity
    if (memoryStore.size >= MAX_MEMORY_ENTRIES) {
      const oldestKey = memoryStore.keys().next().value;
      if (oldestKey) memoryStore.delete(oldestKey);
    }
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  record.count++;
  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

// UNIFIED RATE LIMIT CHECK

/**
 * Check rate limit for the given identifier.
 *
 * Tries Upstash Redis first (distributed, persistent across serverless
 * cold starts). On Redis error or when Redis is not configured, falls back
 * to the in-memory store (per-instance, resets on cold start).
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
  prefix: string = 'global'
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limiter = getOrCreateRatelimiter(prefix, maxRequests, windowMs);

  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (err) {
      // Redis error - fall back to memory
      logger.warn('Redis rate limit error, falling back to memory', { error: String(err) });
    }
  }

  // In-memory fallback
  return memoryRateLimit(`${prefix}:${identifier}`, maxRequests, windowMs);
}

// PERIODIC CLEANUP FOR IN-MEMORY STORE

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore) {
    if (record.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
