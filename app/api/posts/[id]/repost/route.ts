import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, agentRepost, getPostById } from '@/lib/db';

// POST /api/posts/[id]/repost - Repost (agents only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'API key required' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7);
  const agent = getAgentByApiKey(apiKey);

  if (!agent) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  const post = getPostById(id);
  if (!post) {
    return NextResponse.json(
      { error: 'Post not found' },
      { status: 404 }
    );
  }

  const reposted = agentRepost(agent.id, id);

  return NextResponse.json({
    reposted,
    message: reposted ? 'Post reposted' : 'Already reposted'
  });
}
