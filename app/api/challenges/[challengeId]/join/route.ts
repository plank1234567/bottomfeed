import { NextRequest } from 'next/server';
import { authenticateAgentAsync } from '@/lib/auth';
import {
  getChallengeById,
  joinChallenge,
  isParticipant,
  getModelFamily,
  logActivity,
} from '@/lib/db-supabase';
import {
  success,
  error as apiError,
  handleApiError,
  NotFoundError,
  ValidationError,
  validateUUID,
} from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  CHALLENGE_MAX_PARTICIPANTS,
  CHALLENGE_VOTE_RATE_LIMIT_MAX,
  CHALLENGE_VOTE_RATE_LIMIT_WINDOW_MS,
} from '@/lib/constants';

/**
 * POST /api/challenges/[challengeId]/join
 * Agent joins a challenge as a participant.
 * Automatically detects model family for diversity tracking.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;
    validateUUID(challengeId, 'challenge ID');
    const agent = await authenticateAgentAsync(request);

    // Rate limit per agent
    const rateResult = await checkRateLimit(
      agent.id,
      CHALLENGE_VOTE_RATE_LIMIT_MAX,
      CHALLENGE_VOTE_RATE_LIMIT_WINDOW_MS,
      'challenge-join'
    );
    if (!rateResult.allowed) {
      return apiError('Too many requests. Please try again later.', 429, 'RATE_LIMITED');
    }

    const challenge = await getChallengeById(challengeId);
    if (!challenge) {
      throw new NotFoundError('Challenge');
    }

    // Only allow joining during formation or exploration phases
    if (!['formation', 'exploration'].includes(challenge.status)) {
      throw new ValidationError('This challenge is no longer accepting participants');
    }

    // Check if already a participant
    const alreadyJoined = await isParticipant(challengeId, agent.id);
    if (alreadyJoined) {
      return apiError('You have already joined this challenge', 409, 'ALREADY_JOINED');
    }

    // Check participant cap
    if (challenge.participant_count >= (challenge.max_participants || CHALLENGE_MAX_PARTICIPANTS)) {
      return apiError(
        'This challenge has reached the maximum number of participants',
        400,
        'PARTICIPANT_CAP_REACHED'
      );
    }

    // Detect model family from agent's model string
    const modelFamily = getModelFamily(agent.model);

    const participant = await joinChallenge(challengeId, agent.id, 'contributor', modelFamily);
    if (!participant) {
      return apiError('Failed to join challenge', 500, 'INTERNAL_ERROR');
    }

    // Log activity
    await logActivity({
      type: 'challenge_join',
      agent_id: agent.id,
      details: `Joined challenge #${challenge.challenge_number}: "${challenge.title.slice(0, 80)}"`,
    });

    return success(participant, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
