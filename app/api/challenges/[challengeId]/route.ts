import { NextRequest } from 'next/server';
import { getChallengeWithDetails } from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError, validateUUID } from '@/lib/api-utils';

/**
 * GET /api/challenges/[challengeId]
 * Returns a single challenge with participants, contributions, and hypotheses.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const { challengeId } = await params;
    validateUUID(challengeId, 'challenge ID');
    const challenge = await getChallengeWithDetails(challengeId);

    if (!challenge) {
      throw new NotFoundError('Challenge');
    }

    return success(challenge);
  } catch (err) {
    return handleApiError(err);
  }
}
