/**
 * Batch View API Tests
 * Tests the POST handler from app/api/posts/batch-view/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const VALID_UUID_1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_UUID_2 = 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_UUID_3 = 'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee';

vi.mock('@/lib/db-supabase', () => ({
  postExists: vi.fn().mockResolvedValue(true),
  recordPostView: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ip', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/posts/batch-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/posts/batch-view', () => {
  let POST: typeof import('@/app/api/posts/batch-view/route').POST;
  let db: typeof import('@/lib/db-supabase');
  let cache: typeof import('@/lib/cache');

  beforeEach(async () => {
    vi.clearAllMocks();
    db = await import('@/lib/db-supabase');
    cache = await import('@/lib/cache');
    const route = await import('@/app/api/posts/batch-view/route');
    POST = route.POST;
  });

  it('returns 400 for missing post_ids', async () => {
    const request = makeRequest({});
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('post_ids must be an array');
  });

  it('returns 400 when post_ids is not an array', async () => {
    const request = makeRequest({ post_ids: 'not-an-array' });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns 400 for empty array', async () => {
    const request = makeRequest({ post_ids: [] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('between');
  });

  it('returns 400 for array exceeding 50 items', async () => {
    const tooMany = Array.from(
      { length: 51 },
      (_, i) => `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`
    );
    const request = makeRequest({ post_ids: tooMany });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('between');
  });

  it('returns 400 for non-UUID strings', async () => {
    const request = makeRequest({ post_ids: ['not-a-uuid'] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('Invalid');
  });

  it('returns 400 for non-string elements', async () => {
    const request = makeRequest({ post_ids: [123] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('string');
  });

  it('returns 200 with tracked count for valid IDs', async () => {
    vi.mocked(db.postExists).mockResolvedValue(true);
    vi.mocked(cache.getCached).mockResolvedValue(null);

    const request = makeRequest({ post_ids: [VALID_UUID_1, VALID_UUID_2] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tracked).toBe(2);
  });

  it('deduplicates IDs within the request', async () => {
    vi.mocked(db.postExists).mockResolvedValue(true);
    vi.mocked(cache.getCached).mockResolvedValue(null);

    const request = makeRequest({
      post_ids: [VALID_UUID_1, VALID_UUID_1, VALID_UUID_1],
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.tracked).toBe(1);
    // postExists should only be called once for the deduplicated ID
    expect(db.postExists).toHaveBeenCalledTimes(1);
  });

  it('handles non-existent post IDs gracefully', async () => {
    vi.mocked(db.postExists).mockResolvedValue(false);

    const request = makeRequest({ post_ids: [VALID_UUID_1, VALID_UUID_2] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // Non-existent posts should not be tracked
    expect(body.data.tracked).toBe(0);
    expect(db.recordPostView).not.toHaveBeenCalled();
  });

  it('skips already-viewed posts within dedup window', async () => {
    vi.mocked(db.postExists).mockResolvedValue(true);
    // Simulate that this IP already viewed this post
    vi.mocked(cache.getCached).mockResolvedValue(Date.now());

    const request = makeRequest({ post_ids: [VALID_UUID_1] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.tracked).toBe(0);
    expect(db.recordPostView).not.toHaveBeenCalled();
  });

  it('records views and sets dedup cache for new views', async () => {
    vi.mocked(db.postExists).mockResolvedValue(true);
    vi.mocked(cache.getCached).mockResolvedValue(null);

    const request = makeRequest({ post_ids: [VALID_UUID_1] });
    await POST(request);

    expect(db.recordPostView).toHaveBeenCalledWith(VALID_UUID_1);
    expect(cache.setCache).toHaveBeenCalledWith(
      expect.stringContaining(VALID_UUID_1),
      expect.any(Number),
      300000 // 5 minutes in ms
    );
  });

  it('handles mixed existing and non-existing posts', async () => {
    vi.mocked(db.postExists).mockImplementation(async (id: string) => {
      return id === VALID_UUID_1;
    });
    vi.mocked(cache.getCached).mockResolvedValue(null);

    const request = makeRequest({ post_ids: [VALID_UUID_1, VALID_UUID_2, VALID_UUID_3] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    // Only UUID_1 exists, so only 1 should be tracked
    expect(body.data.tracked).toBe(1);
  });

  it('continues processing if individual post view fails', async () => {
    vi.mocked(db.postExists).mockResolvedValue(true);
    vi.mocked(cache.getCached).mockResolvedValue(null);
    // First call throws, second succeeds
    vi.mocked(db.recordPostView)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(true);

    const request = makeRequest({ post_ids: [VALID_UUID_1, VALID_UUID_2] });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // At least one should succeed; the failed one is caught silently
    expect(body.data.tracked).toBeGreaterThanOrEqual(1);
  });

  it('accepts exactly 50 items (the maximum)', async () => {
    vi.mocked(db.postExists).mockResolvedValue(true);
    vi.mocked(cache.getCached).mockResolvedValue(null);

    const maxItems = Array.from(
      { length: 50 },
      (_, i) => `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, '0')}`
    );
    const request = makeRequest({ post_ids: maxItems });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tracked).toBe(50);
  });
});
