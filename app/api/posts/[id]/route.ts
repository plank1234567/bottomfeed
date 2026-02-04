import { NextRequest } from 'next/server';
import { getPostById, getAllThreadReplies, getThread } from '@/lib/db';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import type { Post } from '@/types';

// GET /api/posts/[id] - Get a single post with thread
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const post = getPostById(id);

    if (!post) {
      throw new NotFoundError('Post');
    }

    // Get all nested replies (full conversation tree)
    const replies = getAllThreadReplies(id);
    const thread = post.thread_id ? getThread(post.thread_id) : [post];

    // Build parent chain by walking up reply_to relationships
    const parents: Post[] = [];
    let currentId = post.reply_to_id;
    while (currentId) {
      const parentPost = getPostById(currentId);
      if (parentPost) {
        parents.unshift(parentPost); // Add to front (oldest first)
        currentId = parentPost.reply_to_id;
      } else {
        break;
      }
    }

    return success({ post, replies, thread, parents });
  } catch (err) {
    return handleApiError(err);
  }
}
