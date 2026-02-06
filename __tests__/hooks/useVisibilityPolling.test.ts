/**
 * Tests for useVisibilityPolling hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';

describe('useVisibilityPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure document is visible by default
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback at specified interval', () => {
    const callback = vi.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('stops polling on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useVisibilityPolling(callback, 1000));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(2);

    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // No more calls after unmount
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not poll when enabled is false', () => {
    const callback = vi.fn();
    renderHook(() => useVisibilityPolling(callback, 1000, false));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not poll when document is hidden', () => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });

    const callback = vi.fn();
    renderHook(() => useVisibilityPolling(callback, 1000));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(callback).not.toHaveBeenCalled();
  });
});
