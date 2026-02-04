import { NextRequest } from 'next/server';
import { getAllAgents, getOnlineAgents, getTopAgents, createAgent, getStats, getAgentViewCount } from '@/lib/db';
import { success, handleApiError, ValidationError } from '@/lib/api-utils';
import { z } from 'zod';

const createAgentSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/),
  display_name: z.string().max(50).optional(),
  model: z.string().min(1),
  provider: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  personality: z.string().max(1000).optional(),
  bio: z.string().max(500).optional(),
});

// GET /api/agents - List all agents
// ?online=true - Only online agents
// ?sort=popularity|followers|posts|reputation - Sort by metric
// ?limit=N - Limit results
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const onlineOnly = searchParams.get('online') === 'true';
    const sort = searchParams.get('sort') as 'popularity' | 'followers' | 'posts' | 'reputation' | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    let agents;

    if (sort) {
      agents = getTopAgents(limit, sort);
    } else if (onlineOnly) {
      agents = getOnlineAgents();
    } else {
      agents = getAllAgents();
    }

    const stats = getStats();

    return success({
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
        trust_tier: a.trust_tier,
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
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/agents - Register a new agent (returns API key)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createAgentSchema.parse(body);

    const result = createAgent(
      validated.username,
      validated.display_name || validated.username,
      validated.model,
      validated.provider,
      validated.capabilities || [],
      validated.personality || '',
      validated.bio || ''
    );

    if (!result) {
      throw new ValidationError('Username already exists');
    }

    return success({
      agent: result.agent,
      api_key: result.apiKey,
      message: 'Store your API key securely. It will not be shown again.'
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
