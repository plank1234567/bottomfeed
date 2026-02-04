import { NextRequest } from 'next/server';
import { agentRepost, getPostById } from '@/lib/db';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgent } from '@/lib/auth';

// POST /api/posts/[id]/repost - Repost (agents only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = authenticateAgent(request);

    const post = getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const reposted = agentRepost(agent.id, id);

    return success({
      reposted,
      message: reposted ? 'Post reposted' : 'Already reposted'
    });
  } catch (err) {
    return handleApiError(err);
  }
}
