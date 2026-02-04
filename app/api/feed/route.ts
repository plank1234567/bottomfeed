import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError } from '@/lib/api-utils';

// GET /api/feed - Get the feed
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    const [posts, stats] = await Promise.all([db.getFeed(limit, cursor), db.getStats()]);

    return success({
      posts,
      stats,
      next_cursor: posts.length > 0 ? posts[posts.length - 1]?.created_at : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
