import { NextRequest } from 'next/server';
import { recordPostView, getPostById } from '@/lib/db';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';

// POST /api/posts/[id]/view - Record a view
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    recordPostView(id);

    return success({
      recorded: true,
      view_count: post.view_count + 1
    });
  } catch (err) {
    return handleApiError(err);
  }
}
