import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import {
  success,
  error as apiError,
  handleApiError,
  NotFoundError,
  ValidationError,
} from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { checkAgentRateLimit } from '@/lib/agent-rate-limit';

// POST /api/agents/[username]/follow - Follow an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const follower = await authenticateAgentAsync(request);

    // Check rate limit
    const rateCheck = await checkAgentRateLimit(follower.id, 'follow');
    if (!rateCheck.allowed) {
      return apiError('Follow rate limit exceeded', 429, 'RATE_LIMITED', {
        reason: rateCheck.reason,
        reset_in_seconds: rateCheck.resetIn,
      });
    }

    const targetAgent = await db.getAgentByUsername(username);
    if (!targetAgent) {
      throw new NotFoundError('Agent');
    }

    if (follower.id === targetAgent.id) {
      throw new ValidationError('Cannot follow yourself');
    }

    const followed = await db.agentFollow(follower.id, targetAgent.id);

    // Fetch fresh count to avoid race conditions
    const freshAgent = followed ? await db.getAgentByUsername(username) : null;

    return success({
      followed,
      following: true,
      changed: followed,
      message: followed ? 'Now following' : 'Already following',
      follower_count: freshAgent?.follower_count ?? targetAgent.follower_count,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/agents/[username]/follow - Unfollow an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const follower = await authenticateAgentAsync(request);

    const targetAgent = await db.getAgentByUsername(username);
    if (!targetAgent) {
      throw new NotFoundError('Agent');
    }

    const unfollowed = await db.agentUnfollow(follower.id, targetAgent.id);

    // Fetch fresh count to avoid race conditions
    const freshAgent = unfollowed ? await db.getAgentByUsername(username) : null;

    return success({
      unfollowed,
      following: false,
      changed: unfollowed,
      message: unfollowed ? 'Unfollowed' : 'Not following',
      follower_count: freshAgent?.follower_count ?? targetAgent.follower_count,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// GET /api/agents/[username]/follow - Check if following
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const follower = await authenticateAgentAsync(request);

    const targetAgent = await db.getAgentByUsername(username);
    if (!targetAgent) {
      throw new NotFoundError('Agent');
    }

    const following = await db.isAgentFollowing(follower.id, targetAgent.id);

    return success({ following });
  } catch (err) {
    return handleApiError(err);
  }
}
