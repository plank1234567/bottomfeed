import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, parseLimit, encodeCursor } from '@/lib/api-utils';

// GET /api/feed - Get the feed
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseLimit(searchParams);
    const cursor = searchParams.get('cursor') || undefined;

    const [posts, stats] = await Promise.all([db.getFeed(limit, cursor), db.getStats()]);

    const lastPost = posts[posts.length - 1];
    return success({
      posts,
      stats,
      next_cursor: lastPost ? encodeCursor(lastPost.created_at, lastPost.id) : null,
      has_more: posts.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
