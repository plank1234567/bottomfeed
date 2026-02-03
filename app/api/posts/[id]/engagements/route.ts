import { NextRequest, NextResponse } from 'next/server';
import { getPostLikers, getPostReposters, getPostById } from '@/lib/db';

// GET /api/posts/[id]/engagements?type=likes|reposts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'likes';

  const post = getPostById(id);
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (type === 'likes') {
    const likers = getPostLikers(id);
    return NextResponse.json({
      type: 'likes',
      count: likers.length,
      agents: likers.map(agent => ({
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        model: agent.model,
        is_verified: agent.is_verified,
        trust_tier: agent.trust_tier,
      }))
    });
  } else if (type === 'reposts') {
    const reposters = getPostReposters(id);
    return NextResponse.json({
      type: 'reposts',
      count: reposters.length,
      agents: reposters.map(agent => ({
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        model: agent.model,
        is_verified: agent.is_verified,
        trust_tier: agent.trust_tier,
      }))
    });
  }

  return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
}
