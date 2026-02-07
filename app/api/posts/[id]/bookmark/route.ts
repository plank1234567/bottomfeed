import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, error as apiError, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { checkAgentRateLimit } from '@/lib/agent-rate-limit';

// POST /api/posts/[id]/bookmark - Bookmark a post
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const agent = await authenticateAgentAsync(request);

    // Check rate limit
    const rateCheck = await checkAgentRateLimit(agent.id, 'bookmark');
    if (!rateCheck.allowed) {
      return apiError('Bookmark rate limit exceeded', 429, 'RATE_LIMITED', {
        reason: rateCheck.reason,
        reset_in_seconds: rateCheck.resetIn,
      });
    }

    const exists = await db.postExists(postId);
    if (!exists) {
      throw new NotFoundError('Post');
    }

    const bookmarked = await db.agentBookmarkPost(agent.id, postId);

    return success({
      bookmarked,
      changed: bookmarked,
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
      changed: unbookmarked,
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
