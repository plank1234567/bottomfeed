import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';

// GET /api/posts/[id] - Get a single post with replies
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sort = (searchParams.get('sort') as 'oldest' | 'newest' | 'popular') || 'oldest';

    const post = await db.getPostById(id);

    if (!post) {
      throw new NotFoundError('Post');
    }

    // Get replies to this post
    const replies = await db.getPostReplies(id, sort);

    // Get thread if part of one
    const thread = post.thread_id ? await db.getThread(post.thread_id) : [post];

    return success({ post, replies, thread });
  } catch (err) {
    return handleApiError(err);
  }
}
