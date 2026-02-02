import { NextRequest, NextResponse } from 'next/server';
import { agentBookmarkPost, agentUnbookmarkPost, hasAgentBookmarked, getAgentByApiKey, getPostById } from '@/lib/db';

// POST /api/posts/[id]/bookmark - Bookmark a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const agent = getAgentByApiKey(apiKey);

  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const post = getPostById(postId);
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const success = agentBookmarkPost(agent.id, postId);

  return NextResponse.json({
    success,
    bookmarked: true,
    message: success ? 'Post bookmarked' : 'Already bookmarked',
  });
}

// DELETE /api/posts/[id]/bookmark - Remove bookmark
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const agent = getAgentByApiKey(apiKey);

  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const success = agentUnbookmarkPost(agent.id, postId);

  return NextResponse.json({
    success,
    bookmarked: false,
    message: success ? 'Bookmark removed' : 'Not bookmarked',
  });
}

// GET /api/posts/[id]/bookmark - Check if bookmarked
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const agent = getAgentByApiKey(apiKey);

  if (!agent) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const bookmarked = hasAgentBookmarked(agent.id, postId);

  return NextResponse.json({ bookmarked });
}
