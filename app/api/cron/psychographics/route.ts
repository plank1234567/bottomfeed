import { NextRequest } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { error as apiError, success } from '@/lib/api-utils';
import { supabase } from '@/lib/supabase';
import { withRequest } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { extractAllFeatures } from '@/lib/psychographics/features';
import {
  computeScores,
  applyEMA,
  computeConfidence,
  classifyArchetype,
  computeTrends,
} from '@/lib/psychographics/scoring';
import { MODEL_VERSION } from '@/lib/psychographics/constants';
import {
  getPsychographicProfile,
  extractScoresFromProfile,
  upsertPsychographicProfile,
  upsertPsychographicFeatures,
  insertPsychographicHistory,
  getPsychographicHistory,
  pruneOldHistory,
  invalidatePsychographicCaches,
} from '@/lib/db-supabase';

export const maxDuration = 300;

const BATCH_SIZE = 20;

/**
 * GET /api/cron/psychographics
 *
 * Scheduled every 6 hours. For each active agent with posts:
 * 1. Extract features from behavior, language, debates, network
 * 2. Compute 8-dimension scores
 * 3. Apply EMA smoothing against prior profile
 * 4. Classify archetype
 * 5. Upsert profile + features, insert history
 * 6. Prune old history entries
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const log = withRequest(request);
  const cronStart = Date.now();
  log.info('Cron start', { job: 'psychographics' });

  // Distributed lock to prevent concurrent cron runs
  const redis = getRedis();
  if (redis) {
    const acquired = await redis.set('cron:psychographics:lock', '1', { nx: true, ex: 300 });
    if (!acquired) {
      log.info('Cron skipped (lock held)', { job: 'psychographics' });
      return success({ skipped: true, reason: 'lock_held' });
    }
  }

  try {
    // Fetch active agents with at least 1 post
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, post_count')
      .is('deleted_at', null)
      .gt('post_count', 0)
      .order('post_count', { ascending: false })
      .limit(500);

    if (agentsError) {
      log.error('Error fetching agents for psychographics', { error: agentsError.message });
      return apiError('Failed to fetch agents', 500, 'INTERNAL_ERROR');
    }

    const allAgents = agents || [];
    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < allAgents.length; i += BATCH_SIZE) {
      const batch = allAgents.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async agent => {
          try {
            // 1. Extract features
            const features = await extractAllFeatures(agent.id);

            // 2. Compute raw scores
            const rawScores = computeScores(features);

            // 3. Get prior profile for EMA smoothing
            const priorProfile = await getPsychographicProfile(agent.id);
            const priorScores = priorProfile ? extractScoresFromProfile(priorProfile) : null;
            const smoothedScores = applyEMA(rawScores, priorScores);

            // 4. Compute confidence & stage
            const totalActions = agent.post_count || 0;
            const { stage, confidence } = computeConfidence(totalActions);

            // 5. Classify archetype
            const archetype = classifyArchetype(smoothedScores);

            // 6. Get history for trend detection
            const history = await getPsychographicHistory(agent.id, 4);
            const trends = computeTrends(smoothedScores, history);

            // 7. Upsert profile
            await upsertPsychographicProfile(agent.id, {
              scores: smoothedScores,
              confidence,
              archetype: archetype.name,
              archetypeSecondary: archetype.secondary,
              archetypeConfidence: archetype.confidence,
              profilingStage: stage,
              totalActionsAnalyzed: totalActions,
              modelVersion: MODEL_VERSION,
            });

            // 8. Upsert features
            await upsertPsychographicFeatures(agent.id, features);

            // 9. Insert history snapshot
            await insertPsychographicHistory(agent.id, smoothedScores, archetype.name, stage);

            // Suppress unused variable warning — trends are used for API output
            void trends;

            processed++;
          } catch (err) {
            errors++;
            log.error('Error processing psychographic profile', {
              agentId: agent.id,
              error: String(err),
            });
          }
        })
      );
    }

    // Prune old history
    const pruned = await pruneOldHistory();

    // Invalidate all psychographic caches
    await invalidatePsychographicCaches();

    log.info('Cron complete', {
      job: 'psychographics',
      duration_ms: Date.now() - cronStart,
      agents_total: allAgents.length,
      agents_processed: processed,
      agents_errors: errors,
      history_pruned: pruned,
    });

    return success({
      agents_processed: processed,
      agents_errors: errors,
      history_pruned: pruned,
    });
  } catch (err) {
    log.error('[Cron/Psychographics] Error', err);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
