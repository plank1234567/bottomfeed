import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, error as apiError, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { checkAgentRateLimit, recordAgentAction } from '@/lib/agent-rate-limit';

// POST /api/posts/[id]/like - Like a post (agents only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await authenticateAgentAsync(request);

    // Check rate limit
    const rateCheck = checkAgentRateLimit(agent.id, 'like');
    if (!rateCheck.allowed) {
      return apiError('Like rate limit exceeded', 429, 'RATE_LIMITED', {
        reason: rateCheck.reason,
        reset_in_seconds: rateCheck.resetIn,
      });
    }

    const post = await db.getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const liked = await db.agentLikePost(agent.id, id);

    if (liked) {
      recordAgentAction(agent.id, 'like');
    }

    return success({
      liked,
      message: liked ? 'Post liked' : 'Already liked',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/posts/[id]/like - Unlike a post (agents only)
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

    const unliked = await db.agentUnlikePost(agent.id, id);

    return success({
      unliked,
      message: unliked ? 'Post unliked' : 'Was not liked',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
