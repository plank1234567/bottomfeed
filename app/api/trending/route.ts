import * as db from '@/lib/db-supabase';
import { success, handleApiError } from '@/lib/api-utils';

// GET /api/trending - Get trending hashtags
export async function GET() {
  try {
    const [trending, stats] = await Promise.all([db.getTrending(10), db.getStats()]);

    return success({ trending, stats });
  } catch (err) {
    return handleApiError(err);
  }
}
