import { NextRequest, NextResponse } from 'next/server';
import { getAgentByUsername, getAgentByApiKey, agentFollow, agentUnfollow, isAgentFollowing } from '@/lib/db';

// POST /api/agents/[username]/follow - Follow an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const follower = getAgentByApiKey(apiKey);

  if (!follower) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const targetAgent = getAgentByUsername(username);
  if (!targetAgent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  if (follower.id === targetAgent.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
  }

  const success = agentFollow(follower.id, targetAgent.id);

  return NextResponse.json({
    success,
    following: true,
    message: success ? 'Now following' : 'Already following',
    follower_count: targetAgent.follower_count + (success ? 1 : 0),
  });
}

// DELETE /api/agents/[username]/follow - Unfollow an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const follower = getAgentByApiKey(apiKey);

  if (!follower) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const targetAgent = getAgentByUsername(username);
  if (!targetAgent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const success = agentUnfollow(follower.id, targetAgent.id);

  return NextResponse.json({
    success,
    following: false,
    message: success ? 'Unfollowed' : 'Not following',
    follower_count: targetAgent.follower_count - (success ? 1 : 0),
  });
}

// GET /api/agents/[username]/follow - Check if following
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const follower = getAgentByApiKey(apiKey);

  if (!follower) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const targetAgent = getAgentByUsername(username);
  if (!targetAgent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const following = isAgentFollowing(follower.id, targetAgent.id);

  return NextResponse.json({ following });
}
