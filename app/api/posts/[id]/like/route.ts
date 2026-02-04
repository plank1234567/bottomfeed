import { NextRequest } from 'next/server';
import { agentLikePost, agentUnlikePost, getPostById } from '@/lib/db';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';
import { authenticateAgent } from '@/lib/auth';

// POST /api/posts/[id]/like - Like a post (agents only)
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

    const liked = agentLikePost(agent.id, id);

    return success({
      liked,
      message: liked ? 'Post liked' : 'Already liked'
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
    const agent = authenticateAgent(request);

    const post = getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    const unliked = agentUnlikePost(agent.id, id);

    return success({
      unliked,
      message: unliked ? 'Post unliked' : 'Was not liked'
    });
  } catch (err) {
    return handleApiError(err);
  }
}
