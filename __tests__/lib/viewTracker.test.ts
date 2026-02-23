/**
 * View Tracker Tests
 * Tests the client-side view batching singleton from lib/viewTracker.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need fake timers for debounce tests
// Note: vi.useFakeTimers conflicts with waitFor, but we only use act() here

describe('viewTracker', () => {
  let addView: typeof import('@/lib/viewTracker').addView;
  let flush: typeof import('@/lib/viewTracker').flush;
  let _internals: typeof import('@/lib/viewTracker')._internals;

  let mockSendBeacon: ReturnType<typeof vi.fn>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    // Set up navigator.sendBeacon mock
    mockSendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(globalThis, 'navigator', {
      value: { sendBeacon: mockSendBeacon },
      writable: true,
      configurable: true,
    });

    // Set up fetch mock
    mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = mockFetch;

    // Set up window with addEventListener for beforeunload
    if (typeof globalThis.window === 'undefined') {
      Object.defineProperty(globalThis, 'window', {
        value: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(window, 'addEventListener').mockImplementation(vi.fn());
    }

    // Import fresh module for each test (module-level state is reset)
    const mod = await import('@/lib/viewTracker');
    addView = mod.addView;
    flush = mod.flush;
    _internals = mod._internals;
  });

  afterEach(() => {
    _internals.reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('addView() queues a post ID', () => {
    addView('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(_internals.pendingIds.has('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true);
    expect(_internals.pendingIds.size).toBe(1);
  });

  it('deduplicates the same post ID in the same batch', () => {
    addView('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    addView('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    addView('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(_internals.pendingIds.size).toBe(1);
  });

  it('queues multiple distinct post IDs', () => {
    addView('aaaaaaaa-0000-0000-0000-000000000001');
    addView('aaaaaaaa-0000-0000-0000-000000000002');
    addView('aaaaaaaa-0000-0000-0000-000000000003');
    expect(_internals.pendingIds.size).toBe(3);
  });

  it('sends batch after 2-second debounce', () => {
    addView('aaaaaaaa-0000-0000-0000-000000000001');
    addView('aaaaaaaa-0000-0000-0000-000000000002');

    // Not sent yet
    expect(mockSendBeacon).not.toHaveBeenCalled();

    // Advance past the debounce window
    vi.advanceTimersByTime(2000);

    expect(mockSendBeacon).toHaveBeenCalledOnce();
    // Verify the payload
    const blobArg = mockSendBeacon.mock.calls[0]![1] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(mockSendBeacon.mock.calls[0]![0]).toBe('/api/posts/batch-view');
  });

  it('does not send before debounce period elapses', () => {
    addView('aaaaaaaa-0000-0000-0000-000000000001');

    // Advance only 1 second — should not have sent
    vi.advanceTimersByTime(1000);
    expect(mockSendBeacon).not.toHaveBeenCalled();

    // Advance the remaining 1 second
    vi.advanceTimersByTime(1000);
    expect(mockSendBeacon).toHaveBeenCalledOnce();
  });

  it('resets debounce timer when new views are added', () => {
    addView('aaaaaaaa-0000-0000-0000-000000000001');

    // Advance 1.5 seconds
    vi.advanceTimersByTime(1500);
    expect(mockSendBeacon).not.toHaveBeenCalled();

    // Add another view — this should reset the debounce
    addView('aaaaaaaa-0000-0000-0000-000000000002');

    // Advance another 1.5 seconds (3s total, but only 1.5s since last add)
    vi.advanceTimersByTime(1500);
    expect(mockSendBeacon).not.toHaveBeenCalled();

    // Advance the final 0.5s to complete 2s from last add
    vi.advanceTimersByTime(500);
    expect(mockSendBeacon).toHaveBeenCalledOnce();
  });

  it('flushes immediately when batch reaches MAX_BATCH_SIZE (50)', () => {
    for (let i = 0; i < 50; i++) {
      const id = `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`;
      addView(id);
    }

    // Should have sent immediately without waiting for debounce
    expect(mockSendBeacon).toHaveBeenCalledOnce();
    // Queue should be empty after immediate flush
    expect(_internals.pendingIds.size).toBe(0);
  });

  it('does not flush before reaching MAX_BATCH_SIZE', () => {
    for (let i = 0; i < 49; i++) {
      const id = `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`;
      addView(id);
    }

    // 49 items: should NOT have sent yet
    expect(mockSendBeacon).not.toHaveBeenCalled();
    expect(_internals.pendingIds.size).toBe(49);
  });

  it('flush() sends pending IDs immediately', () => {
    addView('aaaaaaaa-0000-0000-0000-000000000001');
    addView('aaaaaaaa-0000-0000-0000-000000000002');

    expect(mockSendBeacon).not.toHaveBeenCalled();

    flush();

    expect(mockSendBeacon).toHaveBeenCalledOnce();
    expect(_internals.pendingIds.size).toBe(0);
    expect(_internals.debounceTimer).toBeNull();
  });

  it('flush() is a no-op when queue is empty', () => {
    flush();
    expect(mockSendBeacon).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses navigator.sendBeacon when available', () => {
    addView('aaaaaaaa-0000-0000-0000-000000000001');
    flush();

    expect(mockSendBeacon).toHaveBeenCalledOnce();
    expect(mockSendBeacon.mock.calls[0]![0]).toBe('/api/posts/batch-view');
    // Should NOT have used fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon is unavailable', async () => {
    // Remove sendBeacon
    Object.defineProperty(globalThis, 'navigator', {
      value: { sendBeacon: undefined },
      writable: true,
      configurable: true,
    });

    // Re-import to pick up the changed navigator
    vi.resetModules();
    const mod = await import('@/lib/viewTracker');
    mod.addView('aaaaaaaa-0000-0000-0000-000000000001');
    mod.flush();

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0]![0]).toBe('/api/posts/batch-view');
    expect(mockFetch.mock.calls[0]![1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
      })
    );
    // sendBeacon should NOT have been called
    expect(mockSendBeacon).not.toHaveBeenCalled();

    mod._internals.reset();
  });

  it('attaches beforeunload listener on first addView', () => {
    const addEventSpy =
      typeof window !== 'undefined'
        ? window.addEventListener
        : (globalThis.window as unknown as { addEventListener: ReturnType<typeof vi.fn> })
            .addEventListener;

    addView('aaaaaaaa-0000-0000-0000-000000000001');

    expect(addEventSpy).toHaveBeenCalledWith('beforeunload', flush);
  });

  it('attaches beforeunload listener only once across multiple addView calls', () => {
    const addEventSpy =
      typeof window !== 'undefined'
        ? window.addEventListener
        : (globalThis.window as unknown as { addEventListener: ReturnType<typeof vi.fn> })
            .addEventListener;

    addView('aaaaaaaa-0000-0000-0000-000000000001');
    addView('aaaaaaaa-0000-0000-0000-000000000002');
    addView('aaaaaaaa-0000-0000-0000-000000000003');

    // Should only be called once for beforeunload
    const beforeUnloadCalls = (addEventSpy as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => call[0] === 'beforeunload'
    );
    expect(beforeUnloadCalls).toHaveLength(1);
  });

  it('exposes correct constants via _internals', () => {
    expect(_internals.DEBOUNCE_MS).toBe(2000);
    expect(_internals.MAX_BATCH_SIZE).toBe(50);
  });
});
