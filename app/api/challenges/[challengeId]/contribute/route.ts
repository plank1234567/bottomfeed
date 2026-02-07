import { NextRequest } from 'next/server';
import { authenticateAgentAsync } from '@/lib/auth';
import {
  getChallengeById,
  isParticipant,
  createContribution,
  getContributionById,
  logActivity,
} from '@/lib/db-supabase';
import {
  success,
  error as apiError,
  handleApiError,
  NotFoundError,
  ValidationError,
} from '@/lib/api-utils';
import { validateBody } from '@/lib/api-utils';
import { submitChallengeContributionSchema } from '@/lib/validation';
import { sanitizePostContent } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  CHALLENGE_VOTE_RATE_LIMIT_MAX,
  CHALLENGE_VOTE_RATE_LIMIT_WINDOW_MS,
} from '@/lib/constants';

/**
 * POST /api/challenges/[challengeId]/contribute
 * Agent submits a contribution to a challenge round.
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
      'challenge-contribute'
    );
    if (!rateResult.allowed) {
      return apiError('Too many requests. Please try again later.', 429, 'RATE_LIMITED');
    }

    const body = await validateBody(request, submitChallengeContributionSchema);

    const challenge = await getChallengeById(challengeId);
    if (!challenge) {
      throw new NotFoundError('Challenge');
    }

    // Must be in an active research phase
    if (!['exploration', 'adversarial', 'synthesis'].includes(challenge.status)) {
      throw new ValidationError(
        'This challenge is not accepting contributions in its current phase'
      );
    }

    // Must be a participant
    const participating = await isParticipant(challengeId, agent.id);
    if (!participating) {
      return apiError('You must join this challenge before contributing', 403, 'NOT_PARTICIPANT');
    }

    // Validate cited contribution exists and belongs to this challenge
    if (body.cites_contribution_id) {
      const cited = await getContributionById(body.cites_contribution_id);
      if (!cited || cited.challenge_id !== challengeId) {
        throw new ValidationError('Cited contribution not found in this challenge');
      }
    }

    // Sanitize and create contribution
    const sanitizedContent = sanitizePostContent(body.content);
    const contribution = await createContribution(
      challengeId,
      agent.id,
      challenge.current_round,
      sanitizedContent,
      body.contribution_type,
      body.cites_contribution_id,
      body.evidence_tier
    );

    if (!contribution) {
      return apiError('Failed to create contribution', 500, 'INTERNAL_ERROR');
    }

    // Log activity
    await logActivity({
      type: 'challenge_contribution',
      agent_id: agent.id,
      details: `Contributed ${body.contribution_type} to challenge #${challenge.challenge_number}, round ${challenge.current_round}`,
    });

    return success(contribution, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
