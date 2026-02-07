/**
 * Tests for usePageCache hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  usePageCache,
  invalidatePageCache,
  clearPageCache,
  getPageCacheEntry,
  setPageCacheEntry,
} from '@/hooks/usePageCache';

describe('usePageCache', () => {
  beforeEach(() => {
    // Clear the module-level cache between tests
    clearPageCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches data on first render (cache miss)', async () => {
    const fetchFn = vi.fn(async () => ({ items: [1, 2, 3] }));

    const { result } = renderHook(() => usePageCache('test-key', fetchFn));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns cached data immediately on cache hit (fresh)', async () => {
    const fetchFn = vi.fn(async () => 'fresh-data');

    // First render populates cache
    const { result: result1, unmount: unmount1 } = renderHook(() =>
      usePageCache('fresh-key', fetchFn)
    );

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });
    expect(result1.current.data).toBe('fresh-data');
    unmount1();

    // Second render should hit cache
    const fetchFn2 = vi.fn(async () => 'new-data');
    const { result: result2 } = renderHook(() =>
      usePageCache('fresh-key', fetchFn2, { ttl: 60000 })
    );

    // Data should be available immediately from cache, no loading
    expect(result2.current.data).toBe('fresh-data');
    expect(result2.current.loading).toBe(false);
    // Should not fetch since data is fresh
    expect(fetchFn2).not.toHaveBeenCalled();
  });

  it('shows stale data immediately and revalidates in background', async () => {
    // Manually set a stale cache entry
    const staleTimestamp = Date.now() - 120_000; // 2 minutes ago, well past 60s TTL
    setPageCacheEntry('stale-key', 'stale-data');
    // Override timestamp to make it stale -- we need to access the internal cache
    // Use getPageCacheEntry to confirm entry exists, then re-populate via the hook
    expect(getPageCacheEntry('stale-key')).toBe('stale-data');

    // Clear and use a controlled approach: set entry, then manually age it
    clearPageCache();

    // Populate cache, then simulate staleness by using a very short TTL
    const initialFetch = vi.fn(async () => 'initial-data');
    const { unmount } = renderHook(() => usePageCache('stale-key', initialFetch, { ttl: 60000 }));

    await waitFor(() => expect(initialFetch).toHaveBeenCalledTimes(1));
    unmount();

    // Now re-render with a very short TTL so the cached entry is "stale"
    const revalidateFetch = vi.fn(async () => 'revalidated-data');
    const { result } = renderHook(
      () => usePageCache('stale-key', revalidateFetch, { ttl: 0 }) // ttl=0 means always stale
    );

    // Data should be available immediately from stale cache
    expect(result.current.data).toBe('initial-data');
    // Should be revalidating in background
    expect(result.current.revalidating).toBe(true);

    await waitFor(() => {
      expect(result.current.revalidating).toBe(false);
    });

    expect(result.current.data).toBe('revalidated-data');
    expect(revalidateFetch).toHaveBeenCalledTimes(1);
  });

  it('aborts fetch on unmount', async () => {
    let capturedSignal: AbortSignal | null = null;

    const fetchFn = vi.fn(async (signal: AbortSignal) => {
      capturedSignal = signal;
      // Simulate a slow fetch
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => resolve('data'), 5000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { unmount } = renderHook(() => usePageCache('abort-key', fetchFn));

    // Verify fetch was called
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal!.aborted).toBe(false);

    // Unmount should abort
    unmount();

    expect(capturedSignal!.aborted).toBe(true);
  });

  it('skips fetch when enabled=false', async () => {
    const fetchFn = vi.fn(async () => 'should-not-fetch');

    const { result } = renderHook(() => usePageCache('disabled-key', fetchFn, { enabled: false }));

    // Should not be loading and should not call fetchFn
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('starts fetching when enabled changes from false to true', async () => {
    const fetchFn = vi.fn(async () => 'enabled-data');

    const { result, rerender } = renderHook(
      ({ enabled }) => usePageCache('enable-toggle-key', fetchFn, { enabled }),
      { initialProps: { enabled: false } }
    );

    expect(fetchFn).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.data).toBe('enabled-data');
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('refresh() triggers a new fetch', async () => {
    let callCount = 0;
    const fetchFn = vi.fn(async () => `data-${++callCount}`);

    const { result } = renderHook(() => usePageCache('refresh-key', fetchFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe('data-1');

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.data).toBe('data-2');
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('invalidatePageCache() removes specific entry', async () => {
    const fetchFn = vi.fn(async () => 'cached-data');

    const { unmount } = renderHook(() => usePageCache('invalidate-key', fetchFn));

    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    unmount();

    expect(getPageCacheEntry('invalidate-key')).toBe('cached-data');

    invalidatePageCache('invalidate-key');

    expect(getPageCacheEntry('invalidate-key')).toBeUndefined();
  });

  it('clearPageCache() removes all entries', async () => {
    setPageCacheEntry('key-1', 'data-1');
    setPageCacheEntry('key-2', 'data-2');

    expect(getPageCacheEntry('key-1')).toBe('data-1');
    expect(getPageCacheEntry('key-2')).toBe('data-2');

    clearPageCache();

    expect(getPageCacheEntry('key-1')).toBeUndefined();
    expect(getPageCacheEntry('key-2')).toBeUndefined();
  });

  it('evicts oldest entry when cache exceeds MAX_ENTRIES', async () => {
    // Fill cache to limit (50 entries)
    for (let i = 0; i < 50; i++) {
      setPageCacheEntry(`fill-${i}`, `data-${i}`);
    }

    // All 50 should exist
    expect(getPageCacheEntry('fill-0')).toBe('data-0');
    expect(getPageCacheEntry('fill-49')).toBe('data-49');

    // Adding one more should evict the oldest
    setPageCacheEntry('fill-50', 'data-50');

    expect(getPageCacheEntry('fill-50')).toBe('data-50');
    // fill-0 should have been evicted (oldest by timestamp)
    expect(getPageCacheEntry('fill-0')).toBeUndefined();
  });

  it('handles fetch errors gracefully during initial load', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => usePageCache('error-key', fetchFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Data should remain null on error
    expect(result.current.data).toBeNull();
  });

  it('keeps stale data when revalidation fails', async () => {
    // Populate cache first
    const goodFetch = vi.fn(async () => 'good-data');
    const { unmount } = renderHook(() => usePageCache('revalidate-error-key', goodFetch));

    await waitFor(() => expect(goodFetch).toHaveBeenCalledTimes(1));
    unmount();

    // Re-render with error fetch and stale data
    const badFetch = vi.fn(async () => {
      throw new Error('Server error');
    });

    const { result } = renderHook(() => usePageCache('revalidate-error-key', badFetch, { ttl: 0 }));

    // Should show stale data immediately
    expect(result.current.data).toBe('good-data');

    await waitFor(() => {
      expect(result.current.revalidating).toBe(false);
    });

    // Should still show stale data after failed revalidation
    expect(result.current.data).toBe('good-data');
  });

  it('passes AbortSignal to fetchFn', async () => {
    const fetchFn = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return 'data';
    });

    renderHook(() => usePageCache('signal-key', fetchFn));

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});
