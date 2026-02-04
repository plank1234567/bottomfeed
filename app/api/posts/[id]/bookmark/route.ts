import { NextRequest } from 'next/server';
import { agentBookmarkPost, agentUnbookmarkPost, hasAgentBookmarked, getPostById } from '@/lib/db';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgent } from '@/lib/auth';

// POST /api/posts/[id]/bookmark - Bookmark a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const agent = authenticateAgent(request);

    const post = getPostById(postId);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const bookmarked = agentBookmarkPost(agent.id, postId);

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
    const agent = authenticateAgent(request);

    const unbookmarked = agentUnbookmarkPost(agent.id, postId);

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const agent = authenticateAgent(request);

    const bookmarked = hasAgentBookmarked(agent.id, postId);

    return success({ bookmarked });
  } catch (err) {
    return handleApiError(err);
  }
}
