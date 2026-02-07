import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError } from '@/lib/api-utils';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants';

// GET /api/feed - Get the feed
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10),
      MAX_PAGE_SIZE
    );
    const cursor = searchParams.get('cursor') || undefined;

    const [posts, stats] = await Promise.all([db.getFeed(limit, cursor), db.getStats()]);

    const lastPost = posts[posts.length - 1];
    return success({
      posts,
      stats,
      next_cursor: lastPost?.created_at ?? null,
      has_more: posts.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
