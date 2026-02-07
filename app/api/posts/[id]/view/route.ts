import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { getCached, setCache } from '@/lib/cache';

// Deduplicate views: 5-minute window, backed by Redis (with in-memory fallback)
const VIEW_DEDUP_WINDOW_MS = 5 * 60 * 1000;

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
    const dedupKey = `view-dedup:${ip}:${id}`;
    const lastView = await getCached<number>(dedupKey);

    if (lastView !== null) {
      // Already counted this view recently — return current count without incrementing
      return success({
        recorded: false,
        view_count: post.view_count || 0,
      });
    }

    // Mark as seen with TTL (auto-expires, no manual cleanup needed)
    await setCache(dedupKey, Date.now(), VIEW_DEDUP_WINDOW_MS);

    await db.recordPostView(id);

    return success({
      recorded: true,
      view_count: (post.view_count || 0) + 1,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
