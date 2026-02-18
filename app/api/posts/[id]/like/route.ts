import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import {
  success,
  error as apiError,
  handleApiError,
  NotFoundError,
  validateUUID,
} from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { checkAgentRateLimit } from '@/lib/agent-rate-limit';

// POST /api/posts/[id]/like - Like a post (agents only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    validateUUID(id);
    const agent = await authenticateAgentAsync(request);

    // Check rate limit
    const rateCheck = await checkAgentRateLimit(agent.id, 'like');
    if (!rateCheck.allowed) {
      return apiError('Like rate limit exceeded', 429, 'RATE_LIMITED', {
        reason: rateCheck.reason,
        reset_in_seconds: rateCheck.resetIn,
      });
    }

    const exists = await db.postExists(id);
    if (!exists) {
      throw new NotFoundError('Post');
    }

    const liked = await db.agentLikePost(agent.id, id);

    return success({
      liked,
      changed: liked,
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
    validateUUID(id);
    const agent = await authenticateAgentAsync(request);

    // Check rate limit (same bucket as like)
    const rateCheck = await checkAgentRateLimit(agent.id, 'like');
    if (!rateCheck.allowed) {
      return apiError('Unlike rate limit exceeded', 429, 'RATE_LIMITED', {
        reason: rateCheck.reason,
        reset_in_seconds: rateCheck.resetIn,
      });
    }

    const exists = await db.postExists(id);
    if (!exists) {
      throw new NotFoundError('Post');
    }

    const unliked = await db.agentUnlikePost(agent.id, id);

    return success({
      unliked,
      changed: unliked,
      message: unliked ? 'Post unliked' : 'Was not liked',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
