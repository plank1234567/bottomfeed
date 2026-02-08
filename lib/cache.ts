/**
 * Redis-backed TTL cache with in-memory fallback.
 * Uses @upstash/redis as primary store, falls back to in-memory Map on error
 * or when Redis is not configured.
 *
 * Consistency note: on Redis failure, in-memory cache is process-local and
 * will diverge across serverless instances. This is acceptable for our use
 * cases (stats, trending, feed) where brief staleness is harmless.
 */

import { getRedis } from './redis';
import { logger } from './logger';

// IN-MEMORY FALLBACK

const memoryCache = new Map<string, { data: unknown; expiry: number }>();

function memoryGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function memorySet(key: string, data: unknown, ttlMs: number): void {
  // Prevent unbounded growth — sweep expired entries when cache exceeds 1k.
  // On-demand cleanup (vs. periodic timer) avoids background work in serverless.
  if (memoryCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryCache) {
      if (now > v.expiry) memoryCache.delete(k);
    }
  }
  memoryCache.set(key, { data, expiry: Date.now() + ttlMs });
}

function memoryDelete(key: string): void {
  memoryCache.delete(key);
}

function memoryDeletePattern(prefix: string): void {
  const cleanPrefix = prefix.replace(/\*$/, '');
  for (const key of memoryCache.keys()) {
    if (key.startsWith(cleanPrefix)) {
      memoryCache.delete(key);
    }
  }
}

// PUBLIC API

const CACHE_PREFIX = 'bf:cache:';

export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get<T>(`${CACHE_PREFIX}${key}`);
      if (data !== null && data !== undefined) {
        logger.debug('Cache hit', { key, source: 'redis' });
        return data;
      }
      // Redis miss - fall through to memory
    } catch (err) {
      logger.warn('Redis cache get error, falling back to memory', { key, error: String(err) });
    }
  }
  const memResult = memoryGet<T>(key);
  if (memResult !== null) {
    logger.debug('Cache hit', { key, source: 'memory' });
  }
  return memResult;
}

export async function setCache(key: string, data: unknown, ttlMs: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      await redis.set(`${CACHE_PREFIX}${key}`, data, { ex: ttlSeconds });
      return;
    } catch (err) {
      logger.warn('Redis cache set error, falling back to memory', { key, error: String(err) });
    }
  }
  memorySet(key, data, ttlMs);
}

/**
 * Invalidate a single cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`${CACHE_PREFIX}${key}`);
    } catch (err) {
      logger.warn('Redis cache invalidate error', { key, error: String(err) });
    }
  }
  memoryDelete(key);
}

/**
 * Invalidate all cache keys matching a prefix pattern (e.g., `trending:*`).
 * Uses SCAN on Redis to avoid blocking. Falls back to iterating memory map.
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: `${CACHE_PREFIX}${pattern}`,
          count: 100,
        });
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== 0);
    } catch (err) {
      logger.warn('Redis cache invalidatePattern error', { pattern, error: String(err) });
    }
  }
  memoryDeletePattern(pattern);
}

// SYNCHRONOUS API (backward compatibility for existing callers)

/**
 * Synchronous cache get — reads from memory cache only.
 * Use the async `getCached()` for Redis-backed reads.
 */
export function getCachedSync<T>(key: string): T | null {
  return memoryGet<T>(key);
}

/**
 * Synchronous cache set — writes to memory cache only.
 * Use the async `setCache()` for Redis-backed writes.
 */
export function setCacheSync(key: string, data: unknown, ttlMs: number): void {
  memorySet(key, data, ttlMs);
}
