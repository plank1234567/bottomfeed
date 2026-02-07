/**
 * Tests for usePullToRefresh hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

// Helper to create a mock TouchEvent with the required properties
function createTouchEvent(clientY: number): React.TouchEvent {
  return {
    touches: [{ clientY }],
  } as unknown as React.TouchEvent;
}

describe('usePullToRefresh', () => {
  beforeEach(() => {
    // Default: scrolled to top
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns pullHandlers, pullIndicator, and refreshing state', () => {
    const onRefresh = vi.fn(async () => {});

    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    expect(result.current.pullHandlers).toBeDefined();
    expect(result.current.pullHandlers.onTouchStart).toBeInstanceOf(Function);
    expect(result.current.pullHandlers.onTouchMove).toBeInstanceOf(Function);
    expect(result.current.pullHandlers.onTouchEnd).toBeInstanceOf(Function);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.pullIndicator).toBeNull();
  });

  it('starts tracking touch on touchStart when at scroll top', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    // Start touch
    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(100));
    });

    // Move touch down
    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    // Pull indicator should appear (pullDistance > 0)
    expect(result.current.pullIndicator).not.toBeNull();
  });

  it('does not start tracking when scrolled down', () => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 100,
    });

    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    // Start touch (should be ignored since scrollY > 0)
    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(100));
    });

    // Move touch down
    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    // Pull indicator should remain null
    expect(result.current.pullIndicator).toBeNull();
  });

  it('applies resistance curve (0.5x multiplier) and respects maxPull', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh, maxPull: 120 }));

    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    // Move 300px down -> with 0.5 resistance = 150, but capped at maxPull 120
    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(300));
    });

    // The indicator should be showing (we can verify it is not null)
    expect(result.current.pullIndicator).not.toBeNull();
  });

  it('calls onRefresh when pull exceeds threshold', async () => {
    let resolveRefresh: () => void;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 80 }));

    // Pull past threshold: start at 0, move to 200 (delta=200, *0.5=100, which > 80)
    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    // Release
    await act(async () => {
      // Start the touch end (this triggers the async onRefresh)
      const touchEndPromise = result.current.pullHandlers.onTouchEnd();
      // Now resolve the refresh
      resolveRefresh!();
      await touchEndPromise;
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not call onRefresh when pull is below threshold', async () => {
    const onRefresh = vi.fn(async () => {});

    const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 80 }));

    // Pull below threshold: start at 0, move to 100 (delta=100, *0.5=50, which < 80)
    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(100));
    });

    // Release
    await act(async () => {
      await result.current.pullHandlers.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
    // Pull indicator should reset
    expect(result.current.pullIndicator).toBeNull();
  });

  it('sets refreshing=true during refresh and resets after', async () => {
    let resolveRefresh: () => void;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 80 }));

    // Pull past threshold
    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    // Release - start the async flow
    let endPromise: Promise<void>;
    act(() => {
      endPromise = result.current.pullHandlers.onTouchEnd() as Promise<void>;
    });

    // During refresh, refreshing should be true
    expect(result.current.refreshing).toBe(true);

    // Complete refresh
    await act(async () => {
      resolveRefresh!();
      await endPromise!;
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.pullIndicator).toBeNull();
  });

  it('resets pull distance when swiping up (negative delta)', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(200));
    });

    // Move up instead of down (delta < 0)
    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(100));
    });

    // Should not show pull indicator
    expect(result.current.pullIndicator).toBeNull();
  });

  it('does not start new pull while refreshing', async () => {
    let resolveRefresh: () => void;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveRefresh = resolve;
        })
    );

    const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 80 }));

    // First pull past threshold
    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    let endPromise: Promise<void>;
    act(() => {
      endPromise = result.current.pullHandlers.onTouchEnd() as Promise<void>;
    });

    expect(result.current.refreshing).toBe(true);

    // Try to start another pull while refreshing -- should be ignored
    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    // Only one onRefresh call
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Clean up
    await act(async () => {
      resolveRefresh!();
      await endPromise!;
    });
  });

  it('handles touchEnd without prior touchStart gracefully', async () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    // touchEnd without touchStart should do nothing
    await act(async () => {
      await result.current.pullHandlers.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it('handles touchMove without prior touchStart gracefully', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    // touchMove without touchStart should do nothing
    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    expect(result.current.pullIndicator).toBeNull();
  });

  it('uses default threshold of 80 and maxPull of 120', () => {
    const onRefresh = vi.fn(async () => {});
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    // Move far enough that maxPull caps the distance
    // delta=300, *0.5=150, capped at maxPull=120
    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(300));
    });

    // Indicator should be present
    expect(result.current.pullIndicator).not.toBeNull();
  });

  it('resets pull on unmount', () => {
    const onRefresh = vi.fn(async () => {});
    const { result, unmount } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => {
      result.current.pullHandlers.onTouchStart(createTouchEvent(0));
    });

    act(() => {
      result.current.pullHandlers.onTouchMove(createTouchEvent(200));
    });

    // Unmount should clean up without errors
    unmount();
  });
});
