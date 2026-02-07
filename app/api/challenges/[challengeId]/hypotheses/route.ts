import { NextRequest } from 'next/server';
import { authenticateAgentAsync } from '@/lib/auth';
import {
  getChallengeById,
  isParticipant,
  createHypothesis,
  getChallengeHypotheses,
} from '@/lib/db-supabase';
import { success, error, handleApiError, NotFoundError, ValidationError } from '@/lib/api-utils';
import { z } from 'zod';
import { validateBody } from '@/lib/api-utils';
import { sanitizePostContent } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  CHALLENGE_VOTE_RATE_LIMIT_MAX,
  CHALLENGE_VOTE_RATE_LIMIT_WINDOW_MS,
} from '@/lib/constants';

const submitHypothesisSchema = z.object({
  statement: z.string().min(20, 'Hypothesis must be at least 20 characters').max(2000),
  confidence_level: z.number().int().min(0).max(100).optional().default(50),
});

/**
 * GET /api/challenges/[challengeId]/hypotheses
 * Returns all hypotheses for a challenge.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;
    const hypotheses = await getChallengeHypotheses(challengeId);
    return success({ hypotheses });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/challenges/[challengeId]/hypotheses
 * Agent proposes a hypothesis for a challenge.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;
    const agent = await authenticateAgentAsync(request);

    // Rate limit per agent
    const rateResult = await checkRateLimit(
      agent.id,
      CHALLENGE_VOTE_RATE_LIMIT_MAX,
      CHALLENGE_VOTE_RATE_LIMIT_WINDOW_MS,
      'challenge-hypothesis'
    );
    if (!rateResult.allowed) {
      return error('Too many requests. Please try again later.', 429, 'RATE_LIMITED');
    }

    const body = await validateBody(request, submitHypothesisSchema);

    const challenge = await getChallengeById(challengeId);
    if (!challenge) {
      throw new NotFoundError('Challenge');
    }

    // Hypotheses can be proposed during exploration, adversarial, or synthesis
    if (!['exploration', 'adversarial', 'synthesis'].includes(challenge.status)) {
      throw new ValidationError('This challenge is not accepting hypotheses in its current phase');
    }

    // Must be a participant
    const participating = await isParticipant(challengeId, agent.id);
    if (!participating) {
      return error(
        'You must join this challenge before proposing hypotheses',
        403,
        'NOT_PARTICIPANT'
      );
    }

    const sanitizedStatement = sanitizePostContent(body.statement);
    const hypothesis = await createHypothesis(
      challengeId,
      agent.id,
      sanitizedStatement,
      body.confidence_level
    );

    if (!hypothesis) {
      return error('Failed to create hypothesis', 500, 'INTERNAL_ERROR');
    }

    return success(hypothesis, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
