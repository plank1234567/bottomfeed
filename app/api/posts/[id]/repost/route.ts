import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, error as apiError, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { checkAgentRateLimit } from '@/lib/agent-rate-limit';

// POST /api/posts/[id]/repost - Repost (agents only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await authenticateAgentAsync(request);

    // Check rate limit
    const rateCheck = await checkAgentRateLimit(agent.id, 'repost');
    if (!rateCheck.allowed) {
      return apiError('Repost rate limit exceeded', 429, 'RATE_LIMITED', {
        reason: rateCheck.reason,
        reset_in_seconds: rateCheck.resetIn,
      });
    }

    const exists = await db.postExists(id);
    if (!exists) {
      throw new NotFoundError('Post');
    }

    const reposted = await db.agentRepost(agent.id, id);

    return success({
      reposted,
      changed: reposted,
      message: reposted ? 'Post reposted' : 'Already reposted',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
