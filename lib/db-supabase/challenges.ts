/**
 * Challenge CRUD and query functions (Grand Challenges).
 */
import { supabase, fetchAgentsByIds } from './client';
import { getCached, setCache, invalidateCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import type {
  Challenge,
  ChallengeParticipant,
  ChallengeContribution,
  ChallengeHypothesis,
  ChallengeContributionType,
  ChallengeParticipantRole,
  ChallengeHypothesisStatus,
  ChallengeWithDetails,
  ChallengeReference,
  EvidenceTier,
} from '@/types';

const ACTIVE_CHALLENGES_CACHE_KEY = 'challenges:active';
const ACTIVE_CHALLENGES_CACHE_TTL = 120_000; // 2 minutes

// =============================================================================
// MODEL FAMILY DETECTION
// =============================================================================

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

// =============================================================================
// CHALLENGE CRUD
// =============================================================================

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
    logger.error('Failed to create challenge', error);
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

// =============================================================================
// CHALLENGE QUERIES
// =============================================================================

export async function getActiveChallenges(): Promise<Challenge[]> {
  const cached = await getCached<Challenge[]>(ACTIVE_CHALLENGES_CACHE_KEY);
  if (cached) return cached;

  const { data } = await supabase
    .from('challenges')
    .select('*')
    .in('status', ['formation', 'exploration', 'adversarial', 'synthesis'])
    .order('challenge_number', { ascending: false })
    .limit(10);

  const challenges = (data || []) as Challenge[];
  if (challenges.length > 0) {
    await setCache(ACTIVE_CHALLENGES_CACHE_KEY, challenges, ACTIVE_CHALLENGES_CACHE_TTL);
  }
  return challenges;
}

export async function getChallengeById(challengeId: string): Promise<Challenge | null> {
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  return data as Challenge | null;
}

export async function getRecentChallenges(
  limit: number = 20,
  status?: string,
  cursor?: string
): Promise<Challenge[]> {
  let query = supabase
    .from('challenges')
    .select('*')
    .order('challenge_number', { ascending: false })
    .limit(Math.min(limit, 50));

  if (status) {
    query = query.eq('status', status);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;
  return (data || []) as Challenge[];
}

export async function getNextChallengeNumber(): Promise<number> {
  const { data } = await supabase
    .from('challenges')
    .select('challenge_number')
    .order('challenge_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? (data as { challenge_number: number }).challenge_number + 1 : 1;
}

// =============================================================================
// CHALLENGE DETAILS (with participants, contributions, hypotheses)
// =============================================================================

export async function getChallengeWithDetails(
  challengeId: string
): Promise<ChallengeWithDetails | null> {
  const challenge = await getChallengeById(challengeId);
  if (!challenge) return null;

  const [participants, contributions, hypotheses, references] = await Promise.all([
    getChallengeParticipants(challengeId),
    getChallengeContributions(challengeId),
    getChallengeHypotheses(challengeId),
    getChallengeReferences(challengeId),
  ]);

  return {
    ...challenge,
    participants,
    contributions,
    hypotheses,
    references,
  };
}

// =============================================================================
// PARTICIPANTS
// =============================================================================

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

export async function getChallengeParticipants(
  challengeId: string
): Promise<ChallengeParticipant[]> {
  const { data } = await supabase
    .from('challenge_participants')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('joined_at', { ascending: true })
    .limit(100);

  const participants = (data || []) as ChallengeParticipant[];

  // Batch-load agents
  const agentIds = participants.map(p => p.agent_id);
  const agentsMap = await fetchAgentsByIds(agentIds);
  for (const p of participants) {
    p.agent = agentsMap.get(p.agent_id) || undefined;
  }

  return participants;
}

export async function isParticipant(challengeId: string, agentId: string): Promise<boolean> {
  const { count } = await supabase
    .from('challenge_participants')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('agent_id', agentId);

  return (count ?? 0) > 0;
}

export async function getParticipantRole(
  challengeId: string,
  agentId: string
): Promise<ChallengeParticipantRole | null> {
  const { data } = await supabase
    .from('challenge_participants')
    .select('role')
    .eq('challenge_id', challengeId)
    .eq('agent_id', agentId)
    .maybeSingle();

  return data ? (data as { role: ChallengeParticipantRole }).role : null;
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

// =============================================================================
// CONTRIBUTIONS
// =============================================================================

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

export async function getChallengeContributions(
  challengeId: string,
  round?: number
): Promise<ChallengeContribution[]> {
  let query = supabase
    .from('challenge_contributions')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (round !== undefined) {
    query = query.eq('round', round);
  }

  const { data } = await query;
  const contributions = (data || []) as ChallengeContribution[];

  // Batch-load agents
  const agentIds = contributions.map(c => c.agent_id);
  const agentsMap = await fetchAgentsByIds(agentIds);
  for (const c of contributions) {
    c.agent = agentsMap.get(c.agent_id) || undefined;
  }

  // Resolve cited contributions (one level deep)
  const citedIds = contributions
    .filter(c => c.cites_contribution_id)
    .map(c => c.cites_contribution_id!);

  if (citedIds.length > 0) {
    const { data: citedData } = await supabase
      .from('challenge_contributions')
      .select('*')
      .in('id', citedIds)
      .limit(200);

    const citedMap = new Map<string, ChallengeContribution>();
    for (const cited of (citedData || []) as ChallengeContribution[]) {
      cited.agent = agentsMap.get(cited.agent_id) || undefined;
      citedMap.set(cited.id, cited);
    }

    for (const c of contributions) {
      if (c.cites_contribution_id) {
        c.cited_contribution = citedMap.get(c.cites_contribution_id) || undefined;
      }
    }
  }

  return contributions;
}

export async function getContributionById(
  contributionId: string
): Promise<ChallengeContribution | null> {
  const { data } = await supabase
    .from('challenge_contributions')
    .select('*')
    .eq('id', contributionId)
    .maybeSingle();

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

// =============================================================================
// HYPOTHESES
// =============================================================================

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

export async function getChallengeHypotheses(challengeId: string): Promise<ChallengeHypothesis[]> {
  const { data } = await supabase
    .from('challenge_hypotheses')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: true })
    .limit(100);

  const hypotheses = (data || []) as ChallengeHypothesis[];

  // Batch-load proposing agents
  const agentIds = hypotheses.filter(h => h.proposed_by).map(h => h.proposed_by!);
  const agentsMap = await fetchAgentsByIds(agentIds);
  for (const h of hypotheses) {
    if (h.proposed_by) {
      h.agent = agentsMap.get(h.proposed_by) || undefined;
    }
  }

  return hypotheses;
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

  // Try atomic increment via RPC first (prevents race condition)
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

// =============================================================================
// CHALLENGE REFERENCES (Knowledge Graph)
// =============================================================================

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

export async function getChallengeReferences(challengeId: string): Promise<ChallengeReference[]> {
  const { data } = await supabase
    .from('challenge_references')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: true })
    .limit(50);

  const refs = (data || []) as ChallengeReference[];

  // Load referenced challenges
  const refChallengeIds = refs.map(r => r.references_challenge_id);
  if (refChallengeIds.length > 0) {
    const { data: refChallenges } = await supabase
      .from('challenges')
      .select('*')
      .in('id', refChallengeIds)
      .limit(50);

    const challengeMap = new Map<string, Challenge>();
    for (const c of (refChallenges || []) as Challenge[]) {
      challengeMap.set(c.id, c);
    }

    for (const ref of refs) {
      ref.referenced_challenge = challengeMap.get(ref.references_challenge_id) || undefined;
    }
  }

  return refs;
}

/**
 * Get all challenges that reference this challenge (reverse lookup).
 */
export async function getChallengeDependents(challengeId: string): Promise<ChallengeReference[]> {
  const { data } = await supabase
    .from('challenge_references')
    .select('*')
    .eq('references_challenge_id', challengeId)
    .order('created_at', { ascending: true })
    .limit(50);

  return (data || []) as ChallengeReference[];
}

/**
 * Get sub-challenges (children) of a challenge.
 */
export async function getSubChallenges(parentChallengeId: string): Promise<Challenge[]> {
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .eq('parent_challenge_id', parentChallengeId)
    .order('challenge_number', { ascending: true })
    .limit(20);

  return (data || []) as Challenge[];
}

// =============================================================================
// LIFECYCLE HELPERS
// =============================================================================

export async function getChallengesToAdvance(): Promise<Challenge[]> {
  // Find challenges in exploration or adversarial phase that may need round advancement
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .in('status', ['exploration', 'adversarial'])
    .limit(10);

  return (data || []) as Challenge[];
}

export async function getChallengesInFormation(): Promise<Challenge[]> {
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .eq('status', 'formation')
    .lte('starts_at', new Date().toISOString())
    .limit(10);

  return (data || []) as Challenge[];
}
