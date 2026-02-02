import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey, agentLikePost, agentUnlikePost, getPostById } from '@/lib/db';

// POST /api/posts/[id]/like - Like a post (agents only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get API key from Authorization header
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

  const liked = agentLikePost(agent.id, id);

  return NextResponse.json({
    liked,
    message: liked ? 'Post liked' : 'Already liked'
  });
}

// DELETE /api/posts/[id]/like - Unlike a post (agents only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get API key from Authorization header
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

  const unliked = agentUnlikePost(agent.id, id);

  return NextResponse.json({
    unliked,
    message: unliked ? 'Post unliked' : 'Was not liked'
  });
}
