import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Module-level cache that survives component unmounts.
 * Gives instant back-navigation by showing cached data immediately,
 * then revalidating in the background (stale-while-revalidate).
 */
const cache = new Map<string, { data: unknown; timestamp: number }>();

const DEFAULT_TTL = 60_000; // 1 minute — data older than this triggers background revalidation
const MAX_ENTRIES = 50;

interface UsePageCacheOptions {
  /** Time in ms before cached data is considered stale (default 60s). Stale data is still shown instantly. */
  ttl?: number;
  /** Skip fetching entirely (e.g. when dependencies aren't ready) */
  enabled?: boolean;
}

interface UsePageCacheResult<T> {
  data: T | null;
  loading: boolean;
  /** True during background revalidation (data is already shown from cache) */
  revalidating: boolean;
  /** Manually trigger a refetch */
  refresh: () => void;
}

export function usePageCache<T>(
  key: string,
  fetchFn: (signal: AbortSignal) => Promise<T>,
  options: UsePageCacheOptions = {}
): UsePageCacheResult<T> {
  const { ttl = DEFAULT_TTL, enabled = true } = options;

  const cached = cache.get(key);
  const hasFresh = cached != null && Date.now() - cached.timestamp < ttl;

  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  const [loading, setLoading] = useState(cached == null && enabled);
  const [revalidating, setRevalidating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(
    async (isRevalidation: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (isRevalidation) {
        setRevalidating(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await fetchFn(controller.signal);
        if (!mountedRef.current) return;

        // Evict oldest if cache is full
        if (cache.size >= MAX_ENTRIES) {
          const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
          if (oldest) cache.delete(oldest[0]);
        }

        cache.set(key, { data: result, timestamp: Date.now() });
        setData(result);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // On error during revalidation, keep showing stale data
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    },
    [key, fetchFn]
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    if (cached == null) {
      // No cache — fetch immediately (shows skeleton)
      doFetch(false);
    } else if (!hasFresh) {
      // Stale cache — show cached data, revalidate in background
      doFetch(true);
    }
    // Fresh cache — do nothing, data is already set from useState initializer

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const refresh = useCallback(() => {
    doFetch(data != null);
  }, [doFetch, data]);

  return { data, loading, revalidating, refresh };
}

/** Clear a specific cache entry (e.g. after a mutation) */
export function invalidatePageCache(key: string) {
  cache.delete(key);
}

/** Clear all cache entries */
export function clearPageCache() {
  cache.clear();
}

/** Get a cached entry directly (for pages that manage their own state, e.g. feed with infinite scroll) */
export function getPageCacheEntry<T>(key: string): T | undefined {
  const entry = cache.get(key);
  return entry ? (entry.data as T) : undefined;
}

/** Set a cache entry directly (for pages that manage their own state) */
export function setPageCacheEntry<T>(key: string, data: T) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { data, timestamp: Date.now() });
}
