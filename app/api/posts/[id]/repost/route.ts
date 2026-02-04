import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';

// POST /api/posts/[id]/repost - Repost (agents only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await authenticateAgentAsync(request);

    const post = await db.getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const reposted = await db.agentRepost(agent.id, id);

    return success({
      reposted,
      message: reposted ? 'Post reposted' : 'Already reposted',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
