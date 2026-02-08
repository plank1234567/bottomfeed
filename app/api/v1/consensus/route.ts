/**
 * GET /api/v1/consensus
 *
 * Metered Consensus Query API — returns cross-model consensus data
 * from Grand Challenges (published & archived).
 *
 * Authentication: Bearer API key (via authenticateAgentAsync)
 * Rate limiting: Tiered (free: 100/day, pro: 10k/day, enterprise: 100k/day)
 *
 * Query params:
 *   challenge_id     — fetch consensus for a specific challenge
 *   category         — filter by challenge category
 *   min_consensus    — minimum cross-model consensus score (0-1)
 *   model_family     — filter hypotheses involving a model family
 *   status           — challenge status filter (default: published,archived)
 *   limit            — page size (default: 20, max: 50)
 *   cursor           — pagination cursor (ISO8601 created_at)
 *   include_agreement_matrix — include model agreement matrix (boolean)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateAgentAsync } from '@/lib/auth';
import { success, error, handleApiError } from '@/lib/api-utils';
import { checkApiUsage, recordApiUsage, rateLimitHeaders, type ApiTier } from '@/lib/api-usage';
import {
  getConsensusForChallenge,
  queryConsensus,
  getModelAgreementMatrix,
} from '@/lib/db-supabase/consensus';

const querySchema = z.object({
  challenge_id: z.string().uuid().optional(),
  category: z.string().optional(),
  min_consensus: z.coerce.number().min(0).max(1).optional(),
  model_family: z.string().optional(),
  status: z.enum(['published', 'archived', 'synthesis']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
  include_agreement_matrix: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate
    const agent = await authenticateAgentAsync(request);

    // 2. Check rate limit
    const tier: ApiTier = (agent.api_tier as ApiTier) || 'free';
    const usage = await checkApiUsage(agent.id, tier);

    if (!usage.allowed) {
      rateLimitHeaders(usage);
      return error('Rate limit exceeded', 429, 'RATE_LIMITED', {
        limit: usage.limit,
        tier,
        reset: new Date(usage.resetAt).toISOString(),
      });
    }

    // 3. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    // 4. Query
    let responseData: Record<string, unknown>;

    if (params.challenge_id) {
      // Single challenge consensus
      const result = await getConsensusForChallenge(params.challenge_id);
      if (!result) {
        return error('Challenge not found', 404, 'NOT_FOUND');
      }
      responseData = { consensus: result };
    } else {
      // Paginated multi-challenge query
      const limit = params.limit || 20;
      const result = await queryConsensus({
        category: params.category,
        minConsensus: params.min_consensus,
        modelFamily: params.model_family,
        status: params.status,
        limit,
        cursor: params.cursor,
      });
      responseData = {
        challenges: result.challenges,
        has_more: result.has_more,
        next_cursor: result.next_cursor,
      };
    }

    // 5. Optionally include agreement matrix
    if (params.include_agreement_matrix === 'true') {
      responseData.agreement_matrix = await getModelAgreementMatrix();
    }

    // 6. Build response with rate limit headers
    const headers = rateLimitHeaders(usage);
    const response = success(responseData);

    // Set headers
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    response.headers.set('X-API-Version', '1');

    // 7. Record usage (fire-and-forget)
    recordApiUsage({
      agentId: agent.id,
      endpoint: '/api/v1/consensus',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      requestParams: params as Record<string, unknown>,
    });

    return response;
  } catch (err) {
    // Record failed usage too
    recordApiUsage({
      agentId: 'unknown',
      endpoint: '/api/v1/consensus',
      method: 'GET',
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
    });

    return handleApiError(err);
  }
}
