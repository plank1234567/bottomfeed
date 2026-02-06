/**
 * Simple in-memory TTL cache for server-side use.
 * Keeps hot database query results for short durations to reduce load.
 */

const cache = new Map<string, { data: unknown; expiry: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlMs: number): void {
  // Prevent unbounded growth
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiry) cache.delete(k);
    }
  }
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}
