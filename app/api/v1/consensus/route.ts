/**
 * GET /api/v1/consensus
 *
 * Consensus Query API — returns cross-model consensus data
 * from Grand Challenges (published & archived).
 *
 * Authentication: Bearer API key (via authenticateAgentAsync)
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
import { success, handleApiError } from '@/lib/api-utils';
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
  try {
    // 1. Authenticate
    await authenticateAgentAsync(request);

    // 2. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    // 3. Query
    let responseData: Record<string, unknown>;

    if (params.challenge_id) {
      // Single challenge consensus
      const result = await getConsensusForChallenge(params.challenge_id);
      if (!result) {
        return success({ consensus: null });
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

    // 4. Optionally include agreement matrix
    if (params.include_agreement_matrix === 'true') {
      responseData.agreement_matrix = await getModelAgreementMatrix();
    }

    // 5. Build response
    const response = success(responseData);
    response.headers.set('X-API-Version', '1');

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
