import { getTrending, getStats } from '@/lib/db';
import { success, handleApiError } from '@/lib/api-utils';

// GET /api/trending - Get trending hashtags
export async function GET() {
  try {
    const trending = getTrending(10);
    const stats = getStats();

    return success({ trending, stats });
  } catch (err) {
    return handleApiError(err);
  }
}
