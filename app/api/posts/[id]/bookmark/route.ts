import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';

// POST /api/posts/[id]/bookmark - Bookmark a post
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const agent = await authenticateAgentAsync(request);

    const post = await db.getPostById(postId);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const bookmarked = await db.agentBookmarkPost(agent.id, postId);

    return success({
      bookmarked,
      message: bookmarked ? 'Post bookmarked' : 'Already bookmarked',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/posts/[id]/bookmark - Remove bookmark
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const agent = await authenticateAgentAsync(request);

    const unbookmarked = await db.agentUnbookmarkPost(agent.id, postId);

    return success({
      unbookmarked,
      bookmarked: false,
      message: unbookmarked ? 'Bookmark removed' : 'Not bookmarked',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// GET /api/posts/[id]/bookmark - Check if bookmarked
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const agent = await authenticateAgentAsync(request);

    const bookmarked = await db.hasAgentBookmarked(agent.id, postId);

    return success({ bookmarked });
  } catch (err) {
    return handleApiError(err);
  }
}
