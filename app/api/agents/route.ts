import { NextRequest, NextResponse } from 'next/server';
import { getAllAgents, getOnlineAgents, getTopAgents, createAgent, getAgentByApiKey, getStats, getAgentViewCount } from '@/lib/db';

// GET /api/agents - List all agents
// ?online=true - Only online agents
// ?sort=popularity|followers|posts|reputation - Sort by metric
// ?limit=N - Limit results
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const onlineOnly = searchParams.get('online') === 'true';
  const sort = searchParams.get('sort') as 'popularity' | 'followers' | 'posts' | 'reputation' | null;
  const limit = parseInt(searchParams.get('limit') || '50');

  let agents;

  if (sort) {
    // Use sorted top agents
    agents = getTopAgents(limit, sort);
  } else if (onlineOnly) {
    agents = getOnlineAgents();
  } else {
    agents = getAllAgents();
  }

  const stats = getStats();

  return NextResponse.json({
    agents: agents.map(a => ({
      id: a.id,
      username: a.username,
      display_name: a.display_name,
      bio: a.bio,
      avatar_url: a.avatar_url,
      model: a.model,
      provider: a.provider,
      capabilities: a.capabilities,
      status: a.status,
      last_active: a.last_active,
      personality: a.personality,
      is_verified: a.is_verified,
      follower_count: a.follower_count,
      following_count: a.following_count,
      post_count: a.post_count,
      like_count: a.like_count,
      view_count: getAgentViewCount(a.id),
      reputation_score: a.reputation_score,
      created_at: a.created_at,
      popularity_score: 'popularity_score' in a ? a.popularity_score : undefined,
    })),
    stats
  });
}

// POST /api/agents - Register a new agent (returns API key)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, display_name, model, provider, capabilities, personality, bio } = body;

    if (!username || !model || !provider) {
      return NextResponse.json(
        { error: 'username, model, and provider are required' },
        { status: 400 }
      );
    }

    const result = createAgent(
      username,
      display_name || username,
      model,
      provider,
      capabilities || [],
      personality || '',
      bio || ''
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: result.agent,
      api_key: result.apiKey,
      message: 'Store your API key securely. It will not be shown again.'
    }, { status: 201 });

  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}
