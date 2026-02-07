/**
 * Tests for useFeedStream hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedStream } from '@/hooks/useFeedStream';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import type { Post } from '@/types';

// Mock useVisibilityPolling
vi.mock('@/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: vi.fn(),
}));

const mockUseVisibilityPolling = vi.mocked(useVisibilityPolling);

// Minimal mock post for testing
const mockPost: Post = {
  id: 'post-1',
  agent_id: 'agent-1',
  content: 'Test post content',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  likes_count: 0,
  reposts_count: 0,
  replies_count: 0,
  views_count: 0,
};

// Track EventSource instances for assertions
type EventSourceListener = (event: MessageEvent | Event) => void;

interface MockEventSourceInstance {
  url: string;
  listeners: Record<string, EventSourceListener[]>;
  addEventListener: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  // Helper methods for tests
  _triggerEvent: (type: string, data?: unknown) => void;
  _triggerError: () => void;
  _triggerOpen: () => void;
}

let mockEventSources: MockEventSourceInstance[];

class MockEventSource {
  url: string;
  listeners: Record<string, EventSourceListener[]> = {};
  addEventListener = vi.fn((type: string, listener: EventSourceListener) => {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type]!.push(listener);
  });
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    mockEventSources.push(this as unknown as MockEventSourceInstance);
  }

  _triggerEvent(type: string, data?: unknown) {
    const listeners = this.listeners[type] || [];
    const event =
      data !== undefined ? new MessageEvent(type, { data: JSON.stringify(data) }) : new Event(type);
    for (const listener of listeners) {
      listener(event);
    }
  }

  _triggerError() {
    this._triggerEvent('error');
  }

  _triggerOpen() {
    this._triggerEvent('open');
  }
}

describe('useFeedStream', () => {
  beforeEach(() => {
    mockEventSources = [];
    // Install MockEventSource globally
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an EventSource connection to /api/feed/stream', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    renderHook(() => useFeedStream(onNewPosts, pollFallback));

    expect(mockEventSources).toHaveLength(1);
    expect(mockEventSources[0]!.url).toBe('/api/feed/stream');
  });

  it('returns isSSE=true when EventSource is available', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { result } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    expect(result.current.isSSE).toBe(true);
  });

  it('calls onNewPosts when a new-post event is received', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    renderHook(() => useFeedStream(onNewPosts, pollFallback));

    const es = mockEventSources[0]!;

    act(() => {
      es._triggerEvent('new-post', mockPost);
    });

    expect(onNewPosts).toHaveBeenCalledTimes(1);
    expect(onNewPosts).toHaveBeenCalledWith([mockPost]);
  });

  it('parses multiple new-post events correctly', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    renderHook(() => useFeedStream(onNewPosts, pollFallback));

    const es = mockEventSources[0]!;

    const post2: Post = { ...mockPost, id: 'post-2', content: 'Second post' };

    act(() => {
      es._triggerEvent('new-post', mockPost);
      es._triggerEvent('new-post', post2);
    });

    expect(onNewPosts).toHaveBeenCalledTimes(2);
    expect(onNewPosts).toHaveBeenNthCalledWith(1, [mockPost]);
    expect(onNewPosts).toHaveBeenNthCalledWith(2, [post2]);
  });

  it('ignores malformed event data without throwing', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    renderHook(() => useFeedStream(onNewPosts, pollFallback));

    const es = mockEventSources[0]!;

    // Trigger a new-post event with invalid JSON
    act(() => {
      const listeners = es.listeners['new-post'] || [];
      const event = new MessageEvent('new-post', { data: 'not-json{' });
      for (const listener of listeners) {
        listener(event);
      }
    });

    // Should not throw, should not call onNewPosts
    expect(onNewPosts).not.toHaveBeenCalled();
  });

  it('resets failure count on successful open after reconnect', () => {
    vi.useFakeTimers();
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { result } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    // Trigger 2 errors with reconnects between each
    for (let i = 0; i < 2; i++) {
      const es = mockEventSources[mockEventSources.length - 1]!;
      act(() => {
        es._triggerError();
      });
      act(() => {
        vi.advanceTimersByTime(20000);
      });
    }

    // Should still be SSE (only 2 failures, threshold is 5)
    expect(result.current.isSSE).toBe(true);

    // Open event on new connection resets counter
    const latestEs = mockEventSources[mockEventSources.length - 1]!;
    act(() => {
      latestEs._triggerOpen();
    });

    // 2 more errors after reset should not trigger fallback
    for (let i = 0; i < 2; i++) {
      const es = mockEventSources[mockEventSources.length - 1]!;
      act(() => {
        es._triggerError();
      });
      act(() => {
        vi.advanceTimersByTime(20000);
      });
    }

    expect(result.current.isSSE).toBe(true);
    vi.useRealTimers();
  });

  it('resets failure count on successful message', () => {
    vi.useFakeTimers();
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { result } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    // Trigger 2 errors with reconnects
    for (let i = 0; i < 2; i++) {
      const es = mockEventSources[mockEventSources.length - 1]!;
      act(() => {
        es._triggerError();
      });
      act(() => {
        vi.advanceTimersByTime(20000);
      });
    }

    expect(result.current.isSSE).toBe(true);

    // Successful message on reconnected ES resets counter
    const latestEs = mockEventSources[mockEventSources.length - 1]!;
    act(() => {
      latestEs._triggerEvent('new-post', mockPost);
    });

    // 2 more errors after reset should not trigger fallback
    for (let i = 0; i < 2; i++) {
      const es = mockEventSources[mockEventSources.length - 1]!;
      act(() => {
        es._triggerError();
      });
      act(() => {
        vi.advanceTimersByTime(20000);
      });
    }

    expect(result.current.isSSE).toBe(true);
    vi.useRealTimers();
  });

  it('falls back to polling after 5 consecutive errors', () => {
    vi.useFakeTimers();
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { result } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    // Each error closes the current ES and schedules a reconnect with backoff.
    // We trigger error → advance timer → trigger error on new ES, 5 times.
    for (let i = 0; i < 5; i++) {
      const es = mockEventSources[mockEventSources.length - 1]!;
      act(() => {
        es._triggerError();
      });
      if (i < 4) {
        // Advance past the backoff timer to trigger reconnect
        act(() => {
          vi.advanceTimersByTime(20000);
        });
      }
    }

    // Should fall back to polling
    expect(result.current.isSSE).toBe(false);

    // First EventSource should have been closed
    expect(mockEventSources[0]!.close).toHaveBeenCalled();

    // useVisibilityPolling should have been called with usePolling=true
    const lastCall =
      mockUseVisibilityPolling.mock.calls[mockUseVisibilityPolling.mock.calls.length - 1]!;
    expect(lastCall[2]).toBe(true); // enabled=true for polling

    vi.useRealTimers();
  });

  it('closes EventSource on each error and reconnects with backoff', () => {
    vi.useFakeTimers();
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { result } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    const es = mockEventSources[0]!;

    // First error: closes and schedules reconnect at 1s backoff
    act(() => {
      es._triggerError();
    });

    expect(es.close).toHaveBeenCalled();
    expect(mockEventSources).toHaveLength(1); // No new ES yet

    // Advance past 1s backoff
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // New EventSource created
    expect(mockEventSources).toHaveLength(2);
    expect(result.current.isSSE).toBe(true);

    vi.useRealTimers();
  });

  it('closes EventSource on unmount', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { unmount } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    const es = mockEventSources[0]!;

    unmount();

    expect(es.close).toHaveBeenCalled();
  });

  it('falls back to polling when EventSource is undefined', () => {
    // Remove EventSource from global
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { result } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    // Should immediately fall back to polling
    expect(result.current.isSSE).toBe(false);

    // No EventSource should have been created
    expect(mockEventSources).toHaveLength(0);
  });

  it('uses the latest onNewPosts callback via ref', () => {
    const onNewPosts1 = vi.fn();
    const onNewPosts2 = vi.fn();
    const pollFallback = vi.fn();

    const { rerender } = renderHook(({ onNewPosts }) => useFeedStream(onNewPosts, pollFallback), {
      initialProps: { onNewPosts: onNewPosts1 },
    });

    const es = mockEventSources[0]!;

    // Update the callback
    rerender({ onNewPosts: onNewPosts2 });

    // Fire an event -- should use the latest callback
    act(() => {
      es._triggerEvent('new-post', mockPost);
    });

    expect(onNewPosts1).not.toHaveBeenCalled();
    expect(onNewPosts2).toHaveBeenCalledTimes(1);
  });

  it('passes correct pollIntervalMs to useVisibilityPolling', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    renderHook(() => useFeedStream(onNewPosts, pollFallback, 30000));

    // useVisibilityPolling should be called with pollFallback, 30000ms, and usePolling=false (SSE is active)
    expect(mockUseVisibilityPolling).toHaveBeenCalledWith(pollFallback, 30000, false);
  });

  it('uses default pollIntervalMs of 15000', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    renderHook(() => useFeedStream(onNewPosts, pollFallback));

    expect(mockUseVisibilityPolling).toHaveBeenCalledWith(pollFallback, 15000, false);
  });

  it('does not trigger state updates after unmount during error fallback', () => {
    const onNewPosts = vi.fn();
    const pollFallback = vi.fn();

    const { unmount } = renderHook(() => useFeedStream(onNewPosts, pollFallback));

    const es = mockEventSources[0]!;

    // Unmount first
    unmount();

    // Then trigger errors -- should not cause "setState on unmounted component"
    act(() => {
      es._triggerError();
      es._triggerError();
      es._triggerError();
    });

    // Should not throw
  });
});
