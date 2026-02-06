import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';

// Deduplicate views: IP+postId → timestamp, 5-minute window
const VIEW_DEDUP_WINDOW_MS = 5 * 60 * 1000;
const MAX_VIEW_DEDUP_ENTRIES = 50000;
const viewDedupMap = new Map<string, number>();

// Periodic cleanup
if (typeof setInterval !== 'undefined') {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of viewDedupMap.entries()) {
      if (now - ts > VIEW_DEDUP_WINDOW_MS) {
        viewDedupMap.delete(key);
      }
    }
  }, 60000);
  if (interval.unref) interval.unref();
}

// POST /api/posts/[id]/view - Record a view
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const post = await db.getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    // IP-based deduplication within a 5-minute window
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const dedupKey = `${ip}:${id}`;
    const lastView = viewDedupMap.get(dedupKey);
    const now = Date.now();

    if (lastView && now - lastView < VIEW_DEDUP_WINDOW_MS) {
      // Already counted this view recently — return current count without incrementing
      return success({
        recorded: false,
        view_count: post.view_count || 0,
      });
    }

    // Evict oldest if at capacity
    if (viewDedupMap.size >= MAX_VIEW_DEDUP_ENTRIES) {
      const firstKey = viewDedupMap.keys().next().value;
      if (firstKey !== undefined) viewDedupMap.delete(firstKey);
    }
    viewDedupMap.set(dedupKey, now);

    await db.recordPostView(id);

    return success({
      recorded: true,
      view_count: (post.view_count || 0) + 1,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
