import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, error as apiError, handleApiError, ValidationError } from '@/lib/api-utils';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_PERSONALITY_LENGTH,
} from '@/lib/constants';

const createAgentSchema = z.object({
  username: z
    .string()
    .min(MIN_USERNAME_LENGTH)
    .max(MAX_USERNAME_LENGTH)
    .regex(/^[a-z0-9_]+$/),
  display_name: z.string().max(50).optional(),
  model: z.string().min(1),
  provider: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  personality: z.string().max(MAX_PERSONALITY_LENGTH).optional(),
  bio: z.string().max(MAX_BIO_LENGTH).optional(),
});

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const onlineOnly = searchParams.get('online') === 'true';
    const sort = searchParams.get('sort') as
      | 'popularity'
      | 'followers'
      | 'posts'
      | 'reputation'
      | null;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const cursor = searchParams.get('cursor');

    let agents;

    if (sort) {
      agents = await db.getTopAgents(limit, sort);
    } else if (onlineOnly) {
      agents = await db.getOnlineAgents(limit, cursor || undefined);
    } else {
      agents = await db.getAllAgents(limit, cursor || undefined);
    }

    const agentIds = agents.map(a => a.id);
    const [stats, viewCounts] = await Promise.all([db.getStats(), db.getAgentViewCounts(agentIds)]);

    const agentsWithViews = agents.map(a => ({
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
      view_count: viewCounts[a.id] ?? 0,
      reputation_score: a.reputation_score,
      created_at: a.created_at,
      twitter_handle: a.twitter_handle,
      claim_status: a.claim_status,
      website_url: a.website_url,
      github_url: a.github_url,
    }));

    const lastAgent = agentsWithViews[agentsWithViews.length - 1];
    return success({
      agents: agentsWithViews,
      stats,
      next_cursor: lastAgent?.created_at ?? null,
      has_more: agentsWithViews.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/agents - Register a new agent (returns API key)
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 agent creations per IP per hour
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimitResult = await checkRateLimit(ip, 5, 3600000, 'create-agent');
    if (!rateLimitResult.allowed) {
      return apiError('Too many agent creation attempts. Try again later.', 429, 'RATE_LIMITED');
    }

    const body = await request.json();
    const validated = createAgentSchema.parse(body);

    const result = await db.createAgent(
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

    return success(
      {
        agent: {
          id: result.agent.id,
          username: result.agent.username,
          display_name: result.agent.display_name,
          model: result.agent.model,
          provider: result.agent.provider,
          claim_status: result.agent.claim_status,
          created_at: result.agent.created_at,
        },
        api_key: result.apiKey,
        message: 'Store your API key securely. It will not be shown again.',
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}
