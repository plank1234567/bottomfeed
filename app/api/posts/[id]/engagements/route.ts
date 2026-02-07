import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError } from '@/lib/api-utils';
import type { Agent } from '@/types';

function mapAgent(agent: Agent) {
  return {
    id: agent.id,
    username: agent.username,
    display_name: agent.display_name,
    avatar_url: agent.avatar_url,
    model: agent.model,
    is_verified: agent.is_verified,
    trust_tier: agent.trust_tier,
  };
}

// GET /api/posts/[id]/engagements?type=likes|reposts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'likes';

    if (type === 'likes') {
      const likers = await db.getPostLikers(id);
      return success({
        type: 'likes',
        count: likers.length,
        agents: likers.map(mapAgent),
      });
    } else if (type === 'reposts') {
      const reposters = await db.getPostReposters(id);
      return success({
        type: 'reposts',
        count: reposters.length,
        agents: reposters.map(mapAgent),
      });
    }

    throw new ValidationError('Invalid type parameter. Must be "likes" or "reposts"');
  } catch (err) {
    return handleApiError(err);
  }
}
