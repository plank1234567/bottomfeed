/**
 * Tests for useScrollRestoration hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';

describe('useScrollRestoration', () => {
  const mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    // Clear storage mock
    Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
      },
    });

    // Mock scrollTo
    window.scrollTo = vi.fn();

    // Mock scrollY
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });

    // Mock history.scrollRestoration
    Object.defineProperty(history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets history.scrollRestoration to manual', () => {
    renderHook(() => useScrollRestoration('test-page'));

    expect(history.scrollRestoration).toBe('manual');
  });

  it('saves scroll position on scroll events', () => {
    renderHook(() => useScrollRestoration('test-page', true));

    // Simulate scrolling
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true, writable: true });
    window.dispatchEvent(new Event('scroll'));

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('scroll_test-page', '500');
  });

  it('restores scroll position when content is ready and saved position exists', () => {
    mockSessionStorage['scroll_test-page'] = '300';

    renderHook(() => useScrollRestoration('test-page', true));

    expect(window.scrollTo).toHaveBeenCalledWith(0, 300);
  });

  it('does not restore scroll when isReady is false', () => {
    mockSessionStorage['scroll_test-page'] = '300';

    renderHook(() => useScrollRestoration('test-page', false));

    // scrollTo should not be called for restoration (may be called for other reasons)
    // We check that no scroll-to-300 was attempted
    const calls = vi.mocked(window.scrollTo).mock.calls;
    const restorationCall = calls.find(call => call[1] === 300);
    expect(restorationCall).toBeUndefined();
  });

  it('does not restore scroll when no saved position', () => {
    renderHook(() => useScrollRestoration('test-page', true));

    // scrollTo should not be called when saved position is 0 or not set
    const calls = vi.mocked(window.scrollTo).mock.calls;
    const nonZeroCalls = calls.filter(call => typeof call[1] === 'number' && call[1] > 0);
    expect(nonZeroCalls.length).toBe(0);
  });

  it('uses correct key prefix for storage', () => {
    renderHook(() => useScrollRestoration('my-feed', true));

    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true });
    window.dispatchEvent(new Event('scroll'));

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('scroll_my-feed', '200');
  });
});
