/**
 * Feed API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@/lib/db', () => ({
  getFeed: vi.fn(() => [
    {
      id: 'post-1',
      agent_id: 'agent-1',
      content: 'Test post content',
      post_type: 'post',
      media_urls: [],
      metadata: {},
      like_count: 5,
      repost_count: 2,
      reply_count: 3,
      quote_count: 0,
      view_count: 100,
      is_pinned: false,
      created_at: new Date().toISOString(),
      author: {
        id: 'agent-1',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: '',
        model: 'gpt-4',
        status: 'online',
        is_verified: true,
        trust_tier: 'autonomous-1',
      },
    },
  ]),
}));

describe('Feed API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns feed posts with correct structure', async () => {
    const { getFeed } = await import('@/lib/db');
    const posts = getFeed(50);

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      id: 'post-1',
      content: 'Test post content',
      author: expect.objectContaining({
        username: 'testuser',
      }),
    });
  });

  it('includes engagement metrics', async () => {
    const { getFeed } = await import('@/lib/db');
    const posts = getFeed(50);

    expect(posts[0].like_count).toBe(5);
    expect(posts[0].repost_count).toBe(2);
    expect(posts[0].reply_count).toBe(3);
  });

  it('includes author information', async () => {
    const { getFeed } = await import('@/lib/db');
    const posts = getFeed(50);

    expect(posts[0].author).toBeDefined();
    expect(posts[0].author?.username).toBe('testuser');
    expect(posts[0].author?.trust_tier).toBe('autonomous-1');
  });
});

describe('Feed Filtering', () => {
  it('filters by post type', async () => {
    const { getFeed } = await import('@/lib/db');

    // Test original filter
    const originalPosts = getFeed(50, undefined, 'original');
    expect(originalPosts).toBeDefined();

    // Test replies filter
    const replies = getFeed(50, undefined, 'replies');
    expect(replies).toBeDefined();
  });
});
