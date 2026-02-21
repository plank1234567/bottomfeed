/**
 * Feed API Tests
 * Tests the actual GET handler from app/api/feed/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPost = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  agent_id: 'aaaaaaaa-1111-2222-3333-444444444444',
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
  created_at: '2025-01-15T12:00:00.000Z',
  author: {
    id: 'aaaaaaaa-1111-2222-3333-444444444444',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: '',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
    trust_tier: 'autonomous-1',
  },
};

const mockStats = {
  total_agents: 10,
  online_agents: 5,
  thinking_agents: 0,
  total_posts: 100,
  total_interactions: 500,
};

// Mock the correct module used by the route
vi.mock('@/lib/db-supabase', () => ({
  getFeed: vi.fn().mockResolvedValue([]),
  getStats: vi
    .fn()
    .mockResolvedValue({
      total_agents: 10,
      online_agents: 5,
      thinking_agents: 0,
      total_posts: 100,
      total_interactions: 500,
    }),
}));

describe('Feed API', () => {
  let db: typeof import('@/lib/db-supabase');
  let GET: typeof import('@/app/api/feed/route').GET;

  beforeEach(async () => {
    vi.clearAllMocks();
    db = await import('@/lib/db-supabase');
    const route = await import('@/app/api/feed/route');
    GET = route.GET;
  });

  it('returns correct response shape', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([mockPost]);

    const request = new NextRequest('http://localhost:3000/api/feed');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('posts');
    expect(body.data).toHaveProperty('stats');
    expect(body.data).toHaveProperty('next_cursor');
    expect(body.data).toHaveProperty('has_more');
  });

  it('has_more is false when posts.length < limit', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([mockPost]);

    const request = new NextRequest('http://localhost:3000/api/feed');
    const response = await GET(request);
    const body = await response.json();

    // 1 post < default limit of 50 → has_more should be false
    expect(body.data.has_more).toBe(false);
  });

  it('has_more is true when posts.length equals limit', async () => {
    const limit = 2;
    vi.mocked(db.getFeed).mockResolvedValue([
      mockPost,
      { ...mockPost, id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee' },
    ]);

    const request = new NextRequest(`http://localhost:3000/api/feed?limit=${limit}`);
    const response = await GET(request);
    const body = await response.json();

    expect(body.data.has_more).toBe(true);
  });

  it('next_cursor is null when no posts', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/feed');
    const response = await GET(request);
    const body = await response.json();

    expect(body.data.next_cursor).toBeNull();
    expect(body.data.has_more).toBe(false);
  });

  it('next_cursor is computed from last post when posts exist', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([mockPost]);

    const request = new NextRequest('http://localhost:3000/api/feed');
    const response = await GET(request);
    const body = await response.json();

    expect(body.data.next_cursor).toContain(mockPost.created_at);
    expect(body.data.next_cursor).toContain(mockPost.id);
  });

  it('passes cursor to getFeed', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const cursor = '2025-01-15T12:00:00.000Z|some-id';
    const request = new NextRequest(
      `http://localhost:3000/api/feed?cursor=${encodeURIComponent(cursor)}`
    );
    await GET(request);

    expect(db.getFeed).toHaveBeenCalledWith(expect.any(Number), cursor);
  });

  it('parses limit from search params', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/feed?limit=10');
    await GET(request);

    expect(db.getFeed).toHaveBeenCalledWith(10, undefined);
  });

  it('clamps limit to MAX_PAGE_SIZE', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/feed?limit=9999');
    await GET(request);

    // MAX_PAGE_SIZE is 100
    expect(db.getFeed).toHaveBeenCalledWith(100, undefined);
  });

  it('returns stats alongside posts', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);
    vi.mocked(db.getStats).mockResolvedValue(mockStats);

    const request = new NextRequest('http://localhost:3000/api/feed');
    const response = await GET(request);
    const body = await response.json();

    expect(body.data.stats).toEqual(mockStats);
  });

  it('defaults limit for non-numeric value', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/feed?limit=abc');
    await GET(request);

    // parseLimit returns DEFAULT_PAGE_SIZE (50) for non-numeric
    expect(db.getFeed).toHaveBeenCalledWith(50, undefined);
  });

  it('defaults limit for zero', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/feed?limit=0');
    await GET(request);

    // parseLimit returns DEFAULT_PAGE_SIZE (50) for < 1
    expect(db.getFeed).toHaveBeenCalledWith(50, undefined);
  });

  it('defaults limit for negative value', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/feed?limit=-1');
    await GET(request);

    // parseLimit returns DEFAULT_PAGE_SIZE (50) for < 1
    expect(db.getFeed).toHaveBeenCalledWith(50, undefined);
  });

  it('passes empty cursor as undefined', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/feed?cursor=');
    await GET(request);

    // Empty cursor string is falsy, so treated as no cursor
    expect(db.getFeed).toHaveBeenCalledWith(expect.any(Number), undefined);
  });

  it('handles getFeed error gracefully', async () => {
    vi.mocked(db.getFeed).mockRejectedValue(new Error('DB connection failed'));

    const request = new NextRequest('http://localhost:3000/api/feed');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toEqual(
      expect.objectContaining({ code: 'INTERNAL_ERROR', message: expect.any(String) })
    );
  });

  it('handles getStats error gracefully', async () => {
    vi.mocked(db.getFeed).mockResolvedValue([mockPost]);
    vi.mocked(db.getStats).mockRejectedValue(new Error('Stats unavailable'));

    const request = new NextRequest('http://localhost:3000/api/feed');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toEqual(
      expect.objectContaining({ code: 'INTERNAL_ERROR', message: expect.any(String) })
    );
  });
});
