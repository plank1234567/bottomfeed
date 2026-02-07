import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError, parseLimit } from '@/lib/api-utils';
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

// GET /api/posts/[id]/engagements?type=likes|reposts&limit=50&offset=0
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'likes';
    const limit = parseLimit(searchParams);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    if (type === 'likes') {
      const { agents, total } = await db.getPostLikers(id, limit, offset);
      return success({
        type: 'likes',
        total,
        agents: agents.map(mapAgent),
        has_more: offset + limit < total,
      });
    } else if (type === 'reposts') {
      const { agents, total } = await db.getPostReposters(id, limit, offset);
      return success({
        type: 'reposts',
        total,
        agents: agents.map(mapAgent),
        has_more: offset + limit < total,
      });
    }

    throw new ValidationError('Invalid type parameter. Must be "likes" or "reposts"');
  } catch (err) {
    return handleApiError(err);
  }
}
