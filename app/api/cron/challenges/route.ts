import { NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { error as apiError, success } from '@/lib/api-utils';
import {
  getActiveChallenges,
  getChallengesInFormation,
  getChallengesToAdvance,
  createChallenge,
  updateChallengeStatus,
  advanceChallengeRound,
  getNextChallengeNumber,
} from '@/lib/db-supabase';
import { invalidateCache } from '@/lib/cache';
import { CHALLENGE_TOPICS } from '@/lib/challenge-topics';
import {
  CHALLENGE_DEFAULT_ROUNDS,
  CHALLENGE_MAX_PARTICIPANTS,
  CHALLENGE_ROUND_DURATION_HOURS,
  CHALLENGE_FORMATION_HOURS,
} from '@/lib/constants';
import { withRequest } from '@/lib/logger';

export const maxDuration = 300;

/**
 * GET /api/cron/challenges
 *
 * Called periodically to manage challenge lifecycle:
 * 1. Transition formation → exploration for challenges past start time
 * 2. Advance rounds for active challenges (based on time)
 * 3. Create new challenge if none in formation
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const log = withRequest(request);
  const cronStart = Date.now();
  log.info('Cron start', { job: 'challenges' });

  try {
    let challengesTransitioned = 0;
    let roundsAdvanced = 0;
    let newChallengeCreated = false;

    // Step 1: Transition formation → exploration
    const formationChallenges = await getChallengesInFormation();
    for (const challenge of formationChallenges) {
      const updated = await updateChallengeStatus(challenge.id, 'exploration');
      if (updated) {
        challengesTransitioned++;
        log.info('Challenge transitioned to exploration', {
          challengeId: challenge.id,
          challengeNumber: challenge.challenge_number,
        });
      }
    }

    // Step 1b: Transition synthesis → published for challenges stuck > 48h
    let synthesesPublished = 0;
    const SYNTHESIS_TIMEOUT_MS = 48 * 60 * 60 * 1000;
    const synthesisDeadline = new Date(Date.now() - SYNTHESIS_TIMEOUT_MS).toISOString();
    const { data: stuckSyntheses } = await (await import('@/lib/db-supabase/client')).supabase
      .from('challenges')
      .select('id')
      .eq('status', 'synthesis')
      .lt('updated_at', synthesisDeadline)
      .limit(20);

    for (const ch of stuckSyntheses || []) {
      const updated = await updateChallengeStatus(ch.id, 'published');
      if (updated) {
        synthesesPublished++;
        log.info('Challenge transitioned from synthesis to published (48h timeout)', {
          challengeId: ch.id,
        });
      }
    }

    // Step 2: Check if any active challenges need round advancement
    const activeChallenges = await getChallengesToAdvance();
    for (const challenge of activeChallenges) {
      // Advance round every CHALLENGE_ROUND_DURATION_HOURS
      // Simple time-based check: created_at + (current_round * duration) < now
      const roundEndTime =
        new Date(challenge.created_at).getTime() +
        challenge.current_round * CHALLENGE_ROUND_DURATION_HOURS * 60 * 60 * 1000;

      if (Date.now() > roundEndTime) {
        // Check if we need to transition to adversarial phase (halfway through rounds)
        const halfwayRound = Math.ceil(challenge.total_rounds / 2);
        if (challenge.status === 'exploration' && challenge.current_round >= halfwayRound) {
          await updateChallengeStatus(challenge.id, 'adversarial');
          log.info('Challenge transitioned to adversarial', {
            challengeId: challenge.id,
            round: challenge.current_round,
          });
        }

        const advanced = await advanceChallengeRound(challenge.id);
        if (advanced) {
          roundsAdvanced++;
          log.info('Challenge round advanced', {
            challengeId: challenge.id,
            newRound: advanced.current_round,
          });
        }
      }
    }

    // Step 3: Create new challenge if needed (idempotent — handles concurrent cron runs)
    const active = await getActiveChallenges();
    const hasFormation = active.some(c => c.status === 'formation');

    if (!hasFormation) {
      const nextNumber = await getNextChallengeNumber();
      const topicIndex = (nextNumber - 1) % CHALLENGE_TOPICS.length;
      const topic = CHALLENGE_TOPICS[topicIndex]!;

      const now = new Date();
      // Formation period: agents join quickly (CHALLENGE_FORMATION_HOURS)
      const startsAt = new Date(now.getTime() + CHALLENGE_FORMATION_HOURS * 60 * 60 * 1000);

      try {
        const newChallenge = await createChallenge(
          topic.title,
          topic.description,
          nextNumber,
          topic.category,
          CHALLENGE_DEFAULT_ROUNDS,
          CHALLENGE_MAX_PARTICIPANTS,
          startsAt.toISOString()
        );

        if (newChallenge) {
          newChallengeCreated = true;
          log.info('New challenge created', {
            challengeId: newChallenge.id,
            challengeNumber: nextNumber,
            title: topic.title,
          });
        }
      } catch (createErr) {
        // Unique constraint violation on challenge_number means another cron
        // instance already created it — this is expected and safe to ignore.
        const msg = createErr instanceof Error ? createErr.message : '';
        if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
          log.info('Challenge creation skipped (already created by concurrent run)', {
            challengeNumber: nextNumber,
          });
        } else {
          throw createErr;
        }
      }

      await invalidateCache('challenges:active');
    }

    log.info('Cron complete', {
      job: 'challenges',
      duration_ms: Date.now() - cronStart,
      challenges_transitioned: challengesTransitioned,
      syntheses_published: synthesesPublished,
      rounds_advanced: roundsAdvanced,
      new_challenge_created: newChallengeCreated,
    });

    return success({
      challenges_transitioned: challengesTransitioned,
      syntheses_published: synthesesPublished,
      rounds_advanced: roundsAdvanced,
      new_challenge_created: newChallengeCreated,
    });
  } catch (err) {
    log.error('[Cron/Challenges] Error', err);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
