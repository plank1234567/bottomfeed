/**
 * Edge case tests for humanPrefs localStorage utilities
 * Covers error handling branches and boundary conditions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBookmarks,
  getFollowing,
  getMyAgent,
  clearMyAgent,
  addBookmark,
  removeBookmark,
  followAgent,
  unfollowAgent,
  setFollowing,
  setMyAgent,
  hasClaimedAgent,
} from '@/lib/humanPrefs';

describe('humanPrefs edge cases', () => {
  beforeEach(() => {
    // Reset localStorage to a working state
    const store: Record<string, string> = {};
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          Object.keys(store).forEach(k => delete store[k]);
        }),
      },
      configurable: true,
      writable: true,
    });
  });

  describe('getBookmarks with localStorage errors', () => {
    it('returns empty array when localStorage.getItem throws', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => {
            throw new Error('Storage disabled');
          }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      expect(getBookmarks()).toEqual([]);
    });
  });

  describe('getFollowing with localStorage errors', () => {
    it('returns empty array when localStorage.getItem throws', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => {
            throw new Error('Storage disabled');
          }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      expect(getFollowing()).toEqual([]);
    });
  });

  describe('getMyAgent with localStorage errors', () => {
    it('returns null when localStorage.getItem throws', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => {
            throw new Error('Storage disabled');
          }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      expect(getMyAgent()).toBeNull();
    });
  });

  describe('clearMyAgent', () => {
    it('calls localStorage.removeItem', () => {
      setMyAgent('testbot');
      clearMyAgent();
      expect(getMyAgent()).toBeNull();
    });

    it('does not throw when called multiple times', () => {
      expect(() => {
        clearMyAgent();
        clearMyAgent();
      }).not.toThrow();
    });
  });

  describe('addBookmark with storage quota exceeded', () => {
    it('still returns updated array even if setItem throws', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify([])),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError');
          }),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      const result = addBookmark('post-1');
      expect(result).toContain('post-1');
    });
  });

  describe('removeBookmark with storage quota exceeded', () => {
    it('still returns filtered array even if setItem throws', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify(['post-1', 'post-2'])),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError');
          }),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      const result = removeBookmark('post-1');
      expect(result).not.toContain('post-1');
      expect(result).toContain('post-2');
    });
  });

  describe('followAgent with storage quota exceeded', () => {
    it('still returns updated array even if setItem throws', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify([])),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError');
          }),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      const result = followAgent('user-1');
      expect(result).toContain('user-1');
    });
  });

  describe('unfollowAgent with storage quota exceeded', () => {
    it('still returns filtered array even if setItem throws', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify(['user-1', 'user-2'])),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError');
          }),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      const result = unfollowAgent('user-1');
      expect(result).not.toContain('user-1');
    });
  });

  describe('setFollowing with storage quota exceeded', () => {
    it('does not throw when setItem fails', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError');
          }),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      expect(() => setFollowing(['a', 'b'])).not.toThrow();
    });
  });

  describe('setMyAgent with storage quota exceeded', () => {
    it('does not throw when setItem fails', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError');
          }),
          removeItem: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      expect(() => setMyAgent('bot')).not.toThrow();
    });
  });

  describe('hasClaimedAgent', () => {
    it('returns false when no agent is set', () => {
      expect(hasClaimedAgent()).toBe(false);
    });

    it('returns true when agent is set', () => {
      setMyAgent('mybot');
      expect(hasClaimedAgent()).toBe(true);
    });
  });
});
