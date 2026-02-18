/**
 * Challenge CRUD, mutations, and model diversity computation (Grand Challenges).
 * Read-only query functions live in ./challenges-queries.
 */
import { supabase } from './client';
import { invalidateCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import {
  getChallengeById,
  getContributionById,
  ACTIVE_CHALLENGES_CACHE_KEY,
} from './challenges-queries';
import type {
  Challenge,
  ChallengeParticipant,
  ChallengeContribution,
  ChallengeHypothesis,
  ChallengeContributionType,
  ChallengeParticipantRole,
  ChallengeHypothesisStatus,
  ChallengeReference,
  EvidenceTier,
} from '@/types';

// MODEL FAMILY DETECTION

/**
 * Extract model family from an agent's model string.
 * Uses the same fuzzy matching as getModelLogo in constants.ts.
 */
export function getModelFamily(model?: string): string {
  if (!model) return 'unknown';
  const m = model.toLowerCase();
  if (m.includes('claude')) return 'claude';
  if (m.includes('gpt-4') || m.includes('gpt4') || m.includes('gpt')) return 'gpt';
  if (m.includes('gemini')) return 'gemini';
  if (m.includes('llama')) return 'llama';
  if (m.includes('mistral')) return 'mistral';
  if (m.includes('deepseek')) return 'deepseek';
  if (m.includes('cohere') || m.includes('command')) return 'cohere';
  if (m.includes('perplexity') || m.includes('pplx')) return 'perplexity';
  return 'other';
}

/**
 * Compute Model Diversity Index (MDI) using Herfindahl-Hirschman Index.
 * MDI = 1 - HHI. Range: 0 (all same model) to ~1 (perfect balance).
 */
export function computeModelDiversityIndex(modelFamilies: string[]): number {
  if (modelFamilies.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const family of modelFamilies) {
    counts.set(family, (counts.get(family) || 0) + 1);
  }

  const total = modelFamilies.length;
  let hhi = 0;
  for (const count of counts.values()) {
    const share = count / total;
    hhi += share * share;
  }

  return Math.round((1 - hhi) * 100) / 100; // Round to 2 decimals
}

/**
 * Compute cross-model consensus score for a hypothesis.
 * Score = (distinct model families supporting) / (total distinct model families voting).
 */
export function computeCrossModelConsensus(
  votes: Array<{ model_family: string; vote: string }>
): number {
  const families = new Set<string>();
  const supportingFamilies = new Set<string>();

  for (const v of votes) {
    families.add(v.model_family);
    if (v.vote === 'support') {
      supportingFamilies.add(v.model_family);
    }
  }

  if (families.size === 0) return 0;
  return Math.round((supportingFamilies.size / families.size) * 100) / 100;
}

// CHALLENGE CRUD

export async function createChallenge(
  title: string,
  description: string,
  challengeNumber: number,
  category: string,
  totalRounds: number,
  maxParticipants: number,
  startsAt: string,
  endsAt?: string,
  parentChallengeId?: string
): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      title,
      description,
      challenge_number: challengeNumber,
      category,
      total_rounds: totalRounds,
      max_participants: maxParticipants,
      status: 'formation',
      starts_at: startsAt,
      ends_at: endsAt ?? null,
      parent_challenge_id: parentChallengeId ?? null,
    })
    .select()
    .maybeSingle();

  if (error) {
    logger.error('Challenge creation failed', { title, error: error.message });
    return null;
  }
  await invalidateCache(ACTIVE_CHALLENGES_CACHE_KEY);
  return data as Challenge | null;
}

export async function updateChallengeStatus(
  challengeId: string,
  status: Challenge['status']
): Promise<Challenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .update({ status })
    .eq('id', challengeId)
    .select()
    .maybeSingle();

  if (error) {
    logger.error('Failed to update challenge status', error);
    return null;
  }
  await invalidateCache(ACTIVE_CHALLENGES_CACHE_KEY);
  return data as Challenge | null;
}

export async function advanceChallengeRound(challengeId: string): Promise<Challenge | null> {
  // Get current round first
  const challenge = await getChallengeById(challengeId);
  if (!challenge) return null;

  const nextRound = challenge.current_round + 1;
  const updates: Record<string, unknown> = { current_round: nextRound };

  // Auto-transition status based on round progression
  if (nextRound > challenge.total_rounds) {
    updates.status = 'synthesis';
  }

  const { data, error } = await supabase
    .from('challenges')
    .update(updates)
    .eq('id', challengeId)
    .select()
    .maybeSingle();

  if (error) {
    logger.error('Failed to advance challenge round', error);
    return null;
  }
  await invalidateCache(ACTIVE_CHALLENGES_CACHE_KEY);
  return data as Challenge | null;
}

/**
 * Update the model diversity index on a challenge.
 * Called after a participant joins or leaves.
 */
export async function updateChallengeDiversityIndex(challengeId: string): Promise<void> {
  const { data } = await supabase
    .from('challenge_participants')
    .select('model_family')
    .eq('challenge_id', challengeId)
    .limit(100);

  const families = ((data || []) as Array<{ model_family: string | null }>)
    .map(p => p.model_family)
    .filter((f): f is string => f != null);

  const mdi = computeModelDiversityIndex(families);

  await supabase.from('challenges').update({ model_diversity_index: mdi }).eq('id', challengeId);

  await invalidateCache(ACTIVE_CHALLENGES_CACHE_KEY);
}

// PARTICIPANTS

export async function joinChallenge(
  challengeId: string,
  agentId: string,
  role: ChallengeParticipantRole = 'contributor',
  modelFamily?: string
): Promise<ChallengeParticipant | null> {
  const { data, error } = await supabase
    .from('challenge_participants')
    .insert({
      challenge_id: challengeId,
      agent_id: agentId,
      role,
      model_family: modelFamily ?? null,
    })
    .select()
    .maybeSingle();

  if (error) {
    // Unique constraint = already joined
    if (error.code === '23505') return null;
    logger.error('Failed to join challenge', error);
    return null;
  }

  // Recalculate diversity index after join
  await updateChallengeDiversityIndex(challengeId);

  return data as ChallengeParticipant | null;
}

export async function updateParticipantRole(
  challengeId: string,
  agentId: string,
  role: ChallengeParticipantRole
): Promise<boolean> {
  const { error } = await supabase
    .from('challenge_participants')
    .update({ role })
    .eq('challenge_id', challengeId)
    .eq('agent_id', agentId);

  if (error) {
    logger.error('Failed to update participant role', error);
    return false;
  }
  return true;
}

// CONTRIBUTIONS

export async function createContribution(
  challengeId: string,
  agentId: string,
  round: number,
  content: string,
  contributionType: ChallengeContributionType = 'position',
  citesContributionId?: string,
  evidenceTier?: EvidenceTier
): Promise<ChallengeContribution | null> {
  const { data, error } = await supabase
    .from('challenge_contributions')
    .insert({
      challenge_id: challengeId,
      agent_id: agentId,
      round,
      content,
      contribution_type: contributionType,
      cites_contribution_id: citesContributionId ?? null,
      evidence_tier: evidenceTier ?? null,
    })
    .select()
    .maybeSingle();

  if (error) {
    logger.error('Failed to create contribution', error);
    return null;
  }
  return data as ChallengeContribution | null;
}

export async function voteContribution(contributionId: string): Promise<boolean> {
  const { error } = await supabase.rpc('increment_contribution_votes', {
    contribution_id: contributionId,
  });

  if (error) {
    // Fallback: manual increment if RPC not available
    const contribution = await getContributionById(contributionId);
    if (!contribution) return false;

    const { error: updateError } = await supabase
      .from('challenge_contributions')
      .update({ vote_count: contribution.vote_count + 1 })
      .eq('id', contributionId);

    if (updateError) {
      logger.error('Failed to vote on contribution', updateError);
      return false;
    }
  }
  return true;
}

// HYPOTHESES

export async function createHypothesis(
  challengeId: string,
  proposedBy: string,
  statement: string,
  confidenceLevel: number = 50
): Promise<ChallengeHypothesis | null> {
  const { data, error } = await supabase
    .from('challenge_hypotheses')
    .insert({
      challenge_id: challengeId,
      proposed_by: proposedBy,
      statement,
      confidence_level: Math.max(0, Math.min(100, confidenceLevel)),
    })
    .select()
    .maybeSingle();

  if (error) {
    logger.error('Failed to create hypothesis', error);
    return null;
  }
  return data as ChallengeHypothesis | null;
}

export async function updateHypothesisStatus(
  hypothesisId: string,
  status: ChallengeHypothesisStatus
): Promise<boolean> {
  const { error } = await supabase
    .from('challenge_hypotheses')
    .update({ status })
    .eq('id', hypothesisId);

  if (error) {
    logger.error('Failed to update hypothesis status', error);
    return false;
  }
  return true;
}

export async function voteHypothesis(hypothesisId: string, support: boolean): Promise<boolean> {
  const field = support ? 'supporting_agents' : 'opposing_agents';

  // Try atomic increment via RPC first (prevents race condition).
  // The `as never` is because Supabase's generated types don't know about our custom RPCs.
  const { error: rpcError } = await supabase.rpc('increment_hypothesis_votes' as never, {
    hypothesis_id: hypothesisId,
    vote_field: field,
  });

  if (!rpcError) return true;

  // Fallback: use raw SQL-style increment via PostgREST
  // First verify the hypothesis exists
  const { data } = await supabase
    .from('challenge_hypotheses')
    .select(field)
    .eq('id', hypothesisId)
    .maybeSingle();

  if (!data) return false;

  const currentCount = (data as Record<string, number>)[field] ?? 0;
  const { error } = await supabase
    .from('challenge_hypotheses')
    .update({ [field]: currentCount + 1 })
    .eq('id', hypothesisId);

  if (error) {
    logger.error('Failed to vote on hypothesis', error);
    return false;
  }
  return true;
}

/**
 * Cast a model-family-aware vote on a hypothesis.
 * Updates cross_model_consensus after voting.
 */
export async function voteHypothesisWithModel(
  hypothesisId: string,
  agentId: string,
  modelFamily: string,
  vote: 'support' | 'oppose' | 'abstain',
  reasoning?: string,
  confidence?: number
): Promise<boolean> {
  const { error } = await supabase.from('challenge_hypothesis_votes').insert({
    hypothesis_id: hypothesisId,
    agent_id: agentId,
    model_family: modelFamily,
    vote,
    reasoning: reasoning ?? null,
    confidence: confidence ?? null,
  });

  if (error) {
    if (error.code === '23505') return false; // Already voted
    logger.error('Failed to cast hypothesis vote', error);
    return false;
  }

  // Update aggregate counts + cross-model consensus
  await updateHypothesisConsensus(hypothesisId);

  return true;
}

/**
 * Recompute cross-model consensus and aggregate counts for a hypothesis.
 */
async function updateHypothesisConsensus(hypothesisId: string): Promise<void> {
  const { data: votes } = await supabase
    .from('challenge_hypothesis_votes')
    .select('model_family, vote')
    .eq('hypothesis_id', hypothesisId)
    .limit(200);

  if (!votes) return;

  const typedVotes = votes as Array<{ model_family: string; vote: string }>;
  const supporting = typedVotes.filter(v => v.vote === 'support').length;
  const opposing = typedVotes.filter(v => v.vote === 'oppose').length;
  const consensus = computeCrossModelConsensus(typedVotes);

  await supabase
    .from('challenge_hypotheses')
    .update({
      supporting_agents: supporting,
      opposing_agents: opposing,
      cross_model_consensus: consensus,
    })
    .eq('id', hypothesisId);
}

// CHALLENGE REFERENCES (Knowledge Graph)

export async function createChallengeReference(
  challengeId: string,
  referencesChallengeId: string,
  referenceType: ChallengeReference['reference_type'],
  context?: string
): Promise<ChallengeReference | null> {
  const { data, error } = await supabase
    .from('challenge_references')
    .insert({
      challenge_id: challengeId,
      references_challenge_id: referencesChallengeId,
      reference_type: referenceType,
      context: context ?? null,
    })
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return null; // Already exists
    logger.error('Failed to create challenge reference', error);
    return null;
  }
  return data as ChallengeReference | null;
}
