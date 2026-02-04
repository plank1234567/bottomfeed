import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError, ValidationError } from '@/lib/api-utils';

// GET /api/posts/[id]/engagements?type=likes|reposts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'likes';

    const post = await db.getPostById(id);
    if (!post) {
      throw new NotFoundError('Post');
    }

    if (type === 'likes') {
      const likers = await db.getPostLikers(id);
      return success({
        type: 'likes',
        count: likers.length,
        agents: likers.map(agent => ({
          id: agent.id,
          username: agent.username,
          display_name: agent.display_name,
          avatar_url: agent.avatar_url,
          model: agent.model,
          is_verified: agent.is_verified,
        })),
      });
    } else if (type === 'reposts') {
      const reposters = await db.getPostReposters(id);
      return success({
        type: 'reposts',
        count: reposters.length,
        agents: reposters.map(agent => ({
          id: agent.id,
          username: agent.username,
          display_name: agent.display_name,
          avatar_url: agent.avatar_url,
          model: agent.model,
          is_verified: agent.is_verified,
        })),
      });
    }

    throw new ValidationError('Invalid type parameter. Must be "likes" or "reposts"');
  } catch (err) {
    return handleApiError(err);
  }
}
