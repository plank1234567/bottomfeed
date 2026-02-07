/**
 * Tests for lib/feed-pubsub.ts - Feed pub/sub system
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Post } from '@/types';

// Mock Redis before importing the module
const mockRedis = {
  lpush: vi.fn(),
  ltrim: vi.fn(),
  expire: vi.fn(),
  lrange: vi.fn(),
};

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// Import after mocks
const { subscribeToNewPosts, notifyNewPost, getRecentPosts } = await import('@/lib/feed-pubsub');

const mockPost: Post = {
  id: 'post-1',
  agent_id: 'agent-1',
  content: 'Test post',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  likes_count: 0,
  reposts_count: 0,
  replies_count: 0,
  views_count: 0,
};

describe('feed-pubsub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribeToNewPosts', () => {
    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToNewPosts(listener);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('calls listener when notifyNewPost is invoked', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToNewPosts(listener);

      await notifyNewPost(mockPost);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(mockPost);
      unsubscribe();
    });

    it('stops receiving events after unsubscribe', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToNewPosts(listener);

      await notifyNewPost(mockPost);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await notifyNewPost(mockPost);
      expect(listener).toHaveBeenCalledTimes(1); // No additional call
    });

    it('supports multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const unsub1 = subscribeToNewPosts(listener1);
      const unsub2 = subscribeToNewPosts(listener2);

      await notifyNewPost(mockPost);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      unsub1();
      unsub2();
    });
  });

  describe('notifyNewPost', () => {
    it('publishes to Redis', async () => {
      const unsub = subscribeToNewPosts(vi.fn());

      await notifyNewPost(mockPost);

      expect(mockRedis.lpush).toHaveBeenCalledWith('bf:feed:new_posts', JSON.stringify(mockPost));
      expect(mockRedis.ltrim).toHaveBeenCalledWith('bf:feed:new_posts', 0, 49);
      expect(mockRedis.expire).toHaveBeenCalledWith('bf:feed:new_posts', 300);
      unsub();
    });

    it('continues notifying local listeners if Redis fails', async () => {
      mockRedis.lpush.mockRejectedValueOnce(new Error('Redis down'));
      const listener = vi.fn();
      const unsub = subscribeToNewPosts(listener);

      await notifyNewPost(mockPost);

      expect(listener).toHaveBeenCalledWith(mockPost);
      unsub();
    });

    it('does not throw if a listener throws', async () => {
      const badListener = vi.fn(() => {
        throw new Error('listener error');
      });
      const goodListener = vi.fn();
      const unsub1 = subscribeToNewPosts(badListener);
      const unsub2 = subscribeToNewPosts(goodListener);

      await expect(notifyNewPost(mockPost)).resolves.toBeUndefined();
      expect(goodListener).toHaveBeenCalled();
      unsub1();
      unsub2();
    });
  });

  describe('getRecentPosts', () => {
    it('returns parsed posts from Redis', async () => {
      mockRedis.lrange.mockResolvedValueOnce([JSON.stringify(mockPost)]);

      const posts = await getRecentPosts(10);

      expect(posts).toHaveLength(1);
      expect(posts[0]!.id).toBe('post-1');
      expect(mockRedis.lrange).toHaveBeenCalledWith('bf:feed:new_posts', 0, 9);
    });

    it('handles already-parsed objects from Redis', async () => {
      mockRedis.lrange.mockResolvedValueOnce([mockPost]);

      const posts = await getRecentPosts(5);

      expect(posts).toHaveLength(1);
      expect(posts[0]!.id).toBe('post-1');
    });

    it('returns empty array on Redis error', async () => {
      mockRedis.lrange.mockRejectedValueOnce(new Error('Redis down'));

      const posts = await getRecentPosts();

      expect(posts).toEqual([]);
    });

    it('uses default limit of 10', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);

      await getRecentPosts();

      expect(mockRedis.lrange).toHaveBeenCalledWith('bf:feed:new_posts', 0, 9);
    });
  });
});
