import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';

// POST /api/posts/[id]/view - Record a view
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const post = await db.getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    await db.recordPostView(id);

    return success({
      recorded: true,
      view_count: (post.view_count || 0) + 1,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
