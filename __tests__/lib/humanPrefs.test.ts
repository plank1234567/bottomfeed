/**
 * Tests for humanPrefs localStorage utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  getFollowing,
  followAgent,
  unfollowAgent,
  isFollowing,
  setFollowing,
  getMyAgent,
  setMyAgent,
  clearMyAgent,
} from '@/lib/humanPrefs';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Assign mock to global window object
Object.defineProperty(global, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
});

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Bookmarks', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getBookmarks', () => {
    it('returns empty array when no bookmarks', () => {
      expect(getBookmarks()).toEqual([]);
    });

    it('returns stored bookmarks', () => {
      localStorageMock.setItem('bottomfeed_bookmarks', JSON.stringify(['post1', 'post2']));
      expect(getBookmarks()).toEqual(['post1', 'post2']);
    });

    it('handles invalid JSON gracefully', () => {
      localStorageMock.setItem('bottomfeed_bookmarks', 'invalid json');
      // Should not throw
      expect(() => getBookmarks()).not.toThrow();
    });
  });

  describe('addBookmark', () => {
    it('adds bookmark to empty list', () => {
      const result = addBookmark('post1');
      expect(result).toContain('post1');
    });

    it('adds bookmark to front of list', () => {
      addBookmark('post1');
      const result = addBookmark('post2');
      expect(result[0]).toBe('post2');
    });

    it('does not add duplicate bookmarks', () => {
      addBookmark('post1');
      const result = addBookmark('post1');
      expect(result.filter(id => id === 'post1').length).toBe(1);
    });
  });

  describe('removeBookmark', () => {
    it('removes existing bookmark', () => {
      addBookmark('post1');
      addBookmark('post2');
      const result = removeBookmark('post1');
      expect(result).not.toContain('post1');
      expect(result).toContain('post2');
    });

    it('handles removing non-existent bookmark', () => {
      addBookmark('post1');
      const result = removeBookmark('post2');
      expect(result).toEqual(['post1']);
    });
  });

  describe('isBookmarked', () => {
    it('returns true for bookmarked post', () => {
      addBookmark('post1');
      expect(isBookmarked('post1')).toBe(true);
    });

    it('returns false for non-bookmarked post', () => {
      expect(isBookmarked('post1')).toBe(false);
    });
  });
});

describe('Following', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getFollowing', () => {
    it('returns empty array when not following anyone', () => {
      expect(getFollowing()).toEqual([]);
    });

    it('returns stored following list', () => {
      localStorageMock.setItem('bottomfeed_following', JSON.stringify(['user1', 'user2']));
      expect(getFollowing()).toEqual(['user1', 'user2']);
    });
  });

  describe('followAgent', () => {
    it('adds agent to following list', () => {
      const result = followAgent('user1');
      expect(result).toContain('user1');
    });

    it('does not add duplicate follows', () => {
      followAgent('user1');
      const result = followAgent('user1');
      expect(result.filter(u => u === 'user1').length).toBe(1);
    });
  });

  describe('unfollowAgent', () => {
    it('removes agent from following list', () => {
      followAgent('user1');
      followAgent('user2');
      const result = unfollowAgent('user1');
      expect(result).not.toContain('user1');
      expect(result).toContain('user2');
    });
  });

  describe('isFollowing', () => {
    it('returns true for followed agent', () => {
      followAgent('user1');
      expect(isFollowing('user1')).toBe(true);
    });

    it('returns false for non-followed agent', () => {
      expect(isFollowing('user1')).toBe(false);
    });
  });

  describe('setFollowing', () => {
    it('sets following list', () => {
      setFollowing(['user1', 'user2', 'user3']);
      expect(getFollowing()).toEqual(['user1', 'user2', 'user3']);
    });

    it('overwrites existing following list', () => {
      followAgent('olduser');
      setFollowing(['newuser']);
      expect(getFollowing()).toEqual(['newuser']);
    });
  });
});

describe('My Agent', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getMyAgent', () => {
    it('returns null when no agent set', () => {
      expect(getMyAgent()).toBeNull();
    });

    it('returns stored agent username', () => {
      localStorageMock.setItem('bottomfeed_my_agent', 'mybot');
      expect(getMyAgent()).toBe('mybot');
    });
  });

  describe('setMyAgent', () => {
    it('sets agent username', () => {
      setMyAgent('mybot');
      expect(getMyAgent()).toBe('mybot');
    });

    it('overwrites existing agent', () => {
      setMyAgent('oldbot');
      setMyAgent('newbot');
      expect(getMyAgent()).toBe('newbot');
    });
  });

  describe('clearMyAgent', () => {
    it('clears agent username', () => {
      setMyAgent('mybot');
      clearMyAgent();
      expect(getMyAgent()).toBeNull();
    });

    it('handles clearing when no agent set', () => {
      expect(() => clearMyAgent()).not.toThrow();
      expect(getMyAgent()).toBeNull();
    });
  });
});
