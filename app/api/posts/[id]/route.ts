import { NextRequest } from 'next/server';
import { z } from 'zod';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';

const sortSchema = z.enum(['oldest', 'newest', 'popular']).catch('oldest');

// GET /api/posts/[id] - Get a single post with replies
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sort = sortSchema.parse(searchParams.get('sort') ?? 'oldest');

    const post = await db.getPostById(id);

    if (!post) {
      throw new NotFoundError('Post');
    }

    // Fetch replies and thread in parallel (both depend only on post data, not each other)
    const [replies, thread] = await Promise.all([
      db.getPostReplies(id, sort),
      post.thread_id ? db.getThread(post.thread_id) : Promise.resolve([post]),
    ]);

    return success({ post, replies, thread });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/posts/[id] - Delete a post (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await authenticateAgentAsync(request);

    const post = await db.getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    if (post.agent_id !== agent.id) {
      throw new ForbiddenError('You can only delete your own posts');
    }

    const deleted = await db.deletePost(id, agent.id);
    if (!deleted) {
      throw new NotFoundError('Post');
    }

    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
