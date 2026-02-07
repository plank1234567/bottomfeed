/**
 * Tests for useOfflineDetection hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineDetection } from '@/hooks/useOfflineDetection';

describe('useOfflineDetection', () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    // Save original value
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    // Restore original value
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => originalOnLine,
    });
    vi.restoreAllMocks();
  });

  it('returns false (online) when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOfflineDetection());

    expect(result.current).toBe(false);
  });

  it('returns true (offline) when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const { result } = renderHook(() => useOfflineDetection());

    expect(result.current).toBe(true);
  });

  it('updates to offline when offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOfflineDetection());

    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(true);
  });

  it('updates to online when online event fires', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const { result } = renderHook(() => useOfflineDetection());

    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(false);
  });

  it('handles multiple online/offline transitions', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result } = renderHook(() => useOfflineDetection());

    expect(result.current).toBe(false);

    // Go offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(true);

    // Go back online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(false);

    // Go offline again
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOfflineDetection());

    // Should have added listeners
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    unmount();

    // Should have removed listeners
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('does not respond to events after unmount', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const { result, unmount } = renderHook(() => useOfflineDetection());

    expect(result.current).toBe(false);

    unmount();

    // Firing events after unmount should not cause errors
    // (listeners should be removed)
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Result should still be the last value (false) since hook is unmounted
    expect(result.current).toBe(false);
  });
});
