/**
 * Psychographic Profiles — DB operations
 * CRUD for psychographic_profiles, psychographic_features, psychographic_history tables.
 */

import { supabase } from '../supabase';
import { getCached, setCache, invalidateCache, invalidatePattern } from '../cache';
import { logger } from '../logger';
import { PSYCHOGRAPHIC_CACHE_TTL, HISTORY_RETENTION_DAYS } from '../psychographics/constants';
import type { PsychographicDimensionKey } from '@/types';

// =============================================================================
// TYPES (DB row shapes)
// =============================================================================

export interface DbPsychographicProfile {
  id: string;
  agent_id: string;
  intellectual_hunger: number;
  social_assertiveness: number;
  empathic_resonance: number;
  contrarian_spirit: number;
  creative_expression: number;
  tribal_loyalty: number;
  strategic_thinking: number;
  emotional_intensity: number;
  confidence_ih: number;
  confidence_sa: number;
  confidence_er: number;
  confidence_cs: number;
  confidence_ce: number;
  confidence_tl: number;
  confidence_st: number;
  confidence_ei: number;
  archetype: string | null;
  archetype_secondary: string | null;
  archetype_confidence: number;
  profiling_stage: number;
  total_actions_analyzed: number;
  model_version: string;
  computed_at: string;
  created_at: string;
}

const CACHE_KEY_PREFIX = 'psychographic:';

function cacheKey(agentId: string): string {
  return `${CACHE_KEY_PREFIX}${agentId}`;
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get psychographic profile for an agent (cached 5min).
 */
export async function getPsychographicProfile(
  agentId: string
): Promise<DbPsychographicProfile | null> {
  const cached = await getCached<DbPsychographicProfile>(cacheKey(agentId));
  if (cached) return cached;

  const { data, error } = await supabase
    .from('psychographic_profiles')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (error) {
    logger.error('Error fetching psychographic profile', { agentId, error: error.message });
    return null;
  }

  if (data) {
    await setCache(cacheKey(agentId), data, PSYCHOGRAPHIC_CACHE_TTL);
  }

  return data;
}

/**
 * Extract dimension scores from a DB profile row.
 */
export function extractScoresFromProfile(
  profile: DbPsychographicProfile
): Record<PsychographicDimensionKey, number> {
  return {
    intellectual_hunger: profile.intellectual_hunger,
    social_assertiveness: profile.social_assertiveness,
    empathic_resonance: profile.empathic_resonance,
    contrarian_spirit: profile.contrarian_spirit,
    creative_expression: profile.creative_expression,
    tribal_loyalty: profile.tribal_loyalty,
    strategic_thinking: profile.strategic_thinking,
    emotional_intensity: profile.emotional_intensity,
  };
}

// =============================================================================
// UPSERT
// =============================================================================

/**
 * Upsert psychographic profile for an agent.
 */
export async function upsertPsychographicProfile(
  agentId: string,
  data: {
    scores: Record<PsychographicDimensionKey, number>;
    confidence: number;
    archetype: string;
    archetypeSecondary?: string;
    archetypeConfidence: number;
    profilingStage: number;
    totalActionsAnalyzed: number;
    modelVersion: string;
  }
): Promise<boolean> {
  const row = {
    agent_id: agentId,
    intellectual_hunger: data.scores.intellectual_hunger,
    social_assertiveness: data.scores.social_assertiveness,
    empathic_resonance: data.scores.empathic_resonance,
    contrarian_spirit: data.scores.contrarian_spirit,
    creative_expression: data.scores.creative_expression,
    tribal_loyalty: data.scores.tribal_loyalty,
    strategic_thinking: data.scores.strategic_thinking,
    emotional_intensity: data.scores.emotional_intensity,
    confidence_ih: data.confidence,
    confidence_sa: data.confidence,
    confidence_er: data.confidence,
    confidence_cs: data.confidence,
    confidence_ce: data.confidence,
    confidence_tl: data.confidence,
    confidence_st: data.confidence,
    confidence_ei: data.confidence,
    archetype: data.archetype,
    archetype_secondary: data.archetypeSecondary || null,
    archetype_confidence: data.archetypeConfidence,
    profiling_stage: data.profilingStage,
    total_actions_analyzed: data.totalActionsAnalyzed,
    model_version: data.modelVersion,
    computed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('psychographic_profiles')
    .upsert(row, { onConflict: 'agent_id' });

  if (error) {
    logger.error('Error upserting psychographic profile', { agentId, error: error.message });
    return false;
  }

  await invalidateCache(cacheKey(agentId));
  return true;
}

/**
 * Upsert psychographic features (raw feature vectors).
 */
export async function upsertPsychographicFeatures(
  agentId: string,
  features: {
    behavioral: Record<string, number>;
    linguistic: Record<string, number>;
    debate_challenge: Record<string, number>;
    network: Record<string, number>;
  }
): Promise<boolean> {
  const { error } = await supabase.from('psychographic_features').upsert(
    {
      agent_id: agentId,
      behavioral: features.behavioral,
      linguistic: features.linguistic,
      debate_challenge: features.debate_challenge,
      network: features.network,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'agent_id' }
  );

  if (error) {
    logger.error('Error upserting psychographic features', { agentId, error: error.message });
    return false;
  }

  return true;
}

// =============================================================================
// HISTORY
// =============================================================================

/**
 * Insert a psychographic history snapshot.
 */
export async function insertPsychographicHistory(
  agentId: string,
  scores: Record<PsychographicDimensionKey, number>,
  archetype: string,
  profilingStage: number
): Promise<boolean> {
  const { error } = await supabase.from('psychographic_history').insert({
    agent_id: agentId,
    ...scores,
    archetype,
    profiling_stage: profilingStage,
  });

  if (error) {
    logger.error('Error inserting psychographic history', { agentId, error: error.message });
    return false;
  }

  return true;
}

/**
 * Get psychographic history for trend analysis.
 */
export async function getPsychographicHistory(
  agentId: string,
  limit = 10
): Promise<DbPsychographicProfile[]> {
  const { data, error } = await supabase
    .from('psychographic_history')
    .select('*')
    .eq('agent_id', agentId)
    .order('computed_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Error fetching psychographic history', { agentId, error: error.message });
    return [];
  }

  return (data || []) as DbPsychographicProfile[];
}

/**
 * Prune history entries older than retention period.
 */
export async function pruneOldHistory(retentionDays = HISTORY_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const { data, error } = await supabase
    .from('psychographic_history')
    .delete()
    .lt('computed_at', cutoff.toISOString())
    .select('id');

  if (error) {
    logger.error('Error pruning psychographic history', { error: error.message });
    return 0;
  }

  return data?.length || 0;
}

/**
 * Invalidate all psychographic caches.
 */
export async function invalidatePsychographicCaches(): Promise<void> {
  await invalidatePattern(`${CACHE_KEY_PREFIX}*`);
}
