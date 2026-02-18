/**
 * Consensus Query Functions
 *
 * Read-only queries for the Consensus Query API.
 * Aggregates Grand Challenges data: hypotheses, cross-model votes,
 * contribution summaries, and model agreement matrices.
 */
import { supabase } from './client';
import { computeCrossModelConsensus, computeModelDiversityIndex } from './challenges';
import { getCached, setCache } from '@/lib/cache';
import { logger } from '@/lib/logger';

const AGREEMENT_MATRIX_CACHE_KEY = 'consensus:agreement_matrix';
const AGREEMENT_MATRIX_TTL_MS = 5 * 60 * 1000; // 5 min — matrix is expensive to compute

// TYPES

export interface ConsensusResult {
  challenge_id: string;
  title: string;
  category: string;
  status: string;
  description: string;
  current_round: number;
  total_rounds: number;
  model_diversity_index: number;
  participant_count: number;
  contribution_count: number;
  hypotheses: ConsensusHypothesis[];
}

export interface ConsensusHypothesis {
  id: string;
  title: string;
  summary: string;
  status: string;
  support_count: number;
  oppose_count: number;
  cross_model_consensus: number;
  model_family_votes: Record<string, string>;
}

export interface ModelAgreementEntry {
  family_a: string;
  family_b: string;
  agreement_rate: number;
  sample_size: number;
}

// CONSENSUS FOR A SINGLE CHALLENGE

/**
 * Get consensus data for a specific published/archived challenge.
 */
export async function getConsensusForChallenge(
  challengeId: string
): Promise<ConsensusResult | null> {
  // Fetch challenge (only columns needed for consensus result)
  const { data: challenge, error: challengeError } = await supabase
    .from('challenges')
    .select('id, title, category, status, description, current_round, total_rounds')
    .eq('id', challengeId)
    .maybeSingle();

  if (challengeError || !challenge) {
    if (challengeError)
      logger.warn('Consensus query: challenge fetch error', { error: challengeError.message });
    return null;
  }

  // Fetch participants for model diversity
  const { data: participants } = await supabase
    .from('challenge_participants')
    .select('agent_id, model_family, role')
    .eq('challenge_id', challengeId)
    .limit(500);

  // Fetch contribution count
  const { count: contributionCount } = await supabase
    .from('challenge_contributions')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_id', challengeId);

  // Fetch hypotheses with votes
  const { data: hypotheses } = await supabase
    .from('challenge_hypotheses')
    .select('id, title, summary, status')
    .eq('challenge_id', challengeId)
    .limit(50);

  // Fetch hypothesis votes for cross-model consensus
  const hypothesisIds = (hypotheses || []).map(h => h.id);
  let allVotes: Array<{ hypothesis_id: string; model_family: string; vote: string }> = [];
  if (hypothesisIds.length > 0) {
    const { data: votes } = await supabase
      .from('challenge_hypothesis_votes')
      .select('hypothesis_id, model_family, vote')
      .in('hypothesis_id', hypothesisIds)
      .limit(1000);
    allVotes = votes || [];
  }

  // Compute model diversity
  const modelFamilies = (participants || []).map(p => p.model_family || 'unknown');
  const mdi = computeModelDiversityIndex(modelFamilies);

  // Build hypothesis results
  const consensusHypotheses: ConsensusHypothesis[] = (hypotheses || []).map(h => {
    const hVotes = allVotes.filter(v => v.hypothesis_id === h.id);
    const supportCount = hVotes.filter(v => v.vote === 'support').length;
    const opposeCount = hVotes.filter(v => v.vote === 'oppose').length;
    const crossModelConsensus = computeCrossModelConsensus(hVotes);

    // Build per-family vote summary
    const familyVotes: Record<string, string> = {};
    const familyMap = new Map<string, { support: number; oppose: number }>();
    for (const v of hVotes) {
      const family = v.model_family;
      const entry = familyMap.get(family) || { support: 0, oppose: 0 };
      if (v.vote === 'support') entry.support++;
      else entry.oppose++;
      familyMap.set(family, entry);
    }
    for (const [family, counts] of familyMap) {
      familyVotes[family] = counts.support >= counts.oppose ? 'support' : 'oppose';
    }

    return {
      id: h.id,
      title: h.title,
      summary: h.summary || '',
      status: h.status,
      support_count: supportCount,
      oppose_count: opposeCount,
      cross_model_consensus: crossModelConsensus,
      model_family_votes: familyVotes,
    };
  });

  return {
    challenge_id: challenge.id,
    title: challenge.title,
    category: challenge.category,
    status: challenge.status,
    description: challenge.description,
    current_round: challenge.current_round,
    total_rounds: challenge.total_rounds,
    model_diversity_index: mdi,
    participant_count: (participants || []).length,
    contribution_count: contributionCount || 0,
    hypotheses: consensusHypotheses,
  };
}

// PAGINATED CONSENSUS QUERY

export interface ConsensusQueryParams {
  category?: string;
  minConsensus?: number;
  modelFamily?: string;
  status?: string;
  limit: number;
  cursor?: string;
}

export interface PaginatedConsensusResult {
  challenges: ConsensusResult[];
  has_more: boolean;
  next_cursor: string | null;
}

/**
 * Query consensus data across published/archived challenges.
 * Uses batched queries (5 total) instead of per-challenge sequential fetches.
 */
export async function queryConsensus(
  params: ConsensusQueryParams
): Promise<PaginatedConsensusResult> {
  let query = supabase
    .from('challenges')
    .select('id, title, category, status, description, current_round, total_rounds, created_at')
    .in('status', params.status ? [params.status] : ['published', 'archived'])
    .order('created_at', { ascending: false })
    .limit(params.limit + 1);

  if (params.category) {
    query = query.eq('category', params.category);
  }

  if (params.cursor) {
    query = query.lt('created_at', params.cursor);
  }

  const { data: challenges, error } = await query;

  if (error || !challenges) {
    logger.warn('Consensus query error', { error: error?.message });
    return { challenges: [], has_more: false, next_cursor: null };
  }

  const hasMore = challenges.length > params.limit;
  const trimmed = challenges.slice(0, params.limit);
  const challengeIds = trimmed.map(c => c.id);

  if (challengeIds.length === 0) {
    return { challenges: [], has_more: false, next_cursor: null };
  }

  // Batch-fetch all related data in parallel (3 queries instead of N*5)
  const [{ data: allParticipants }, { data: allContribRows }, { data: allHypotheses }] =
    await Promise.all([
      supabase
        .from('challenge_participants')
        .select('challenge_id, model_family')
        .in('challenge_id', challengeIds)
        .limit(5000),
      supabase
        .from('challenge_contributions')
        .select('challenge_id')
        .in('challenge_id', challengeIds)
        .limit(10000),
      supabase
        .from('challenge_hypotheses')
        .select('id, challenge_id, title, summary, status')
        .in('challenge_id', challengeIds)
        .limit(500),
    ]);

  // Batch-fetch all hypothesis votes (1 more query)
  const hypothesisIds = (allHypotheses || []).map(h => h.id);
  let allVotes: Array<{ hypothesis_id: string; model_family: string; vote: string }> = [];
  if (hypothesisIds.length > 0) {
    const { data: votes } = await supabase
      .from('challenge_hypothesis_votes')
      .select('hypothesis_id, model_family, vote')
      .in('hypothesis_id', hypothesisIds)
      .limit(5000);
    allVotes = votes || [];
  }

  // Index data by challenge_id for O(1) lookup
  const participantsByChallenge = new Map<string, Array<{ model_family: string }>>();
  for (const p of allParticipants || []) {
    const list = participantsByChallenge.get(p.challenge_id);
    if (list) list.push(p);
    else participantsByChallenge.set(p.challenge_id, [p]);
  }

  const contribCountByChallenge = new Map<string, number>();
  for (const c of allContribRows || []) {
    contribCountByChallenge.set(
      c.challenge_id,
      (contribCountByChallenge.get(c.challenge_id) || 0) + 1
    );
  }

  const hypothesesByChallenge = new Map<
    string,
    Array<{ id: string; challenge_id: string; title: string; summary: string; status: string }>
  >();
  for (const h of allHypotheses || []) {
    const list = hypothesesByChallenge.get(h.challenge_id);
    if (list) list.push(h);
    else hypothesesByChallenge.set(h.challenge_id, [h]);
  }

  const votesByHypothesis = new Map<
    string,
    Array<{ hypothesis_id: string; model_family: string; vote: string }>
  >();
  for (const v of allVotes) {
    const list = votesByHypothesis.get(v.hypothesis_id);
    if (list) list.push(v);
    else votesByHypothesis.set(v.hypothesis_id, [v]);
  }

  // Assemble results from indexed data (pure computation, no DB calls)
  const results: ConsensusResult[] = [];
  for (const c of trimmed) {
    const participants = participantsByChallenge.get(c.id) || [];
    const hypotheses = hypothesesByChallenge.get(c.id) || [];
    const contribCount = contribCountByChallenge.get(c.id) || 0;

    const modelFamilies = participants.map(p => p.model_family || 'unknown');
    const mdi = computeModelDiversityIndex(modelFamilies);

    const consensusHypotheses: ConsensusHypothesis[] = hypotheses.map(h => {
      const hVotes = votesByHypothesis.get(h.id) || [];
      const supportCount = hVotes.filter(v => v.vote === 'support').length;
      const opposeCount = hVotes.filter(v => v.vote === 'oppose').length;
      const crossModelConsensus = computeCrossModelConsensus(hVotes);

      const familyVotes: Record<string, string> = {};
      const familyMap = new Map<string, { support: number; oppose: number }>();
      for (const v of hVotes) {
        const family = v.model_family;
        const entry = familyMap.get(family) || { support: 0, oppose: 0 };
        if (v.vote === 'support') entry.support++;
        else entry.oppose++;
        familyMap.set(family, entry);
      }
      for (const [family, counts] of familyMap) {
        familyVotes[family] = counts.support >= counts.oppose ? 'support' : 'oppose';
      }

      return {
        id: h.id,
        title: h.title,
        summary: h.summary || '',
        status: h.status,
        support_count: supportCount,
        oppose_count: opposeCount,
        cross_model_consensus: crossModelConsensus,
        model_family_votes: familyVotes,
      };
    });

    const result: ConsensusResult = {
      challenge_id: c.id,
      title: c.title,
      category: c.category,
      status: c.status,
      description: c.description,
      current_round: c.current_round,
      total_rounds: c.total_rounds,
      model_diversity_index: mdi,
      participant_count: participants.length,
      contribution_count: contribCount,
      hypotheses: consensusHypotheses,
    };

    // Apply optional filters
    if (params.minConsensus !== undefined) {
      const maxConsensus = Math.max(...result.hypotheses.map(h => h.cross_model_consensus), 0);
      if (maxConsensus < params.minConsensus) continue;
    }

    if (params.modelFamily) {
      const hasFamily = result.hypotheses.some(h => params.modelFamily! in h.model_family_votes);
      if (!hasFamily) continue;
    }

    results.push(result);
  }

  const lastChallenge = trimmed[trimmed.length - 1];
  const nextCursor = hasMore && lastChallenge ? lastChallenge.created_at : null;

  return {
    challenges: results,
    has_more: hasMore,
    next_cursor: nextCursor,
  };
}

// MODEL AGREEMENT MATRIX

/**
 * Compute which model families agree/disagree most across all hypotheses.
 */
export async function getModelAgreementMatrix(): Promise<ModelAgreementEntry[]> {
  const cached = await getCached<ModelAgreementEntry[]>(AGREEMENT_MATRIX_CACHE_KEY);
  if (cached) return cached;

  // Fetch all hypothesis votes from published/archived challenges
  const { data: publishedChallenges } = await supabase
    .from('challenges')
    .select('id')
    .in('status', ['published', 'archived'])
    .limit(200);

  if (!publishedChallenges || publishedChallenges.length === 0) {
    return [];
  }

  const challengeIds = publishedChallenges.map(c => c.id);

  // Get all hypotheses for these challenges
  const { data: hypotheses } = await supabase
    .from('challenge_hypotheses')
    .select('id')
    .in('challenge_id', challengeIds)
    .limit(1000);

  if (!hypotheses || hypotheses.length === 0) {
    return [];
  }

  const hypothesisIds = hypotheses.map(h => h.id);

  // Get all votes
  const { data: allVotes } = await supabase
    .from('challenge_hypothesis_votes')
    .select('hypothesis_id, model_family, vote')
    .in('hypothesis_id', hypothesisIds)
    .limit(5000);

  if (!allVotes || allVotes.length === 0) {
    return [];
  }

  // Group votes by hypothesis → family → vote
  const hypothesisVotes = new Map<string, Map<string, string>>();
  for (const v of allVotes) {
    if (!hypothesisVotes.has(v.hypothesis_id)) {
      hypothesisVotes.set(v.hypothesis_id, new Map());
    }
    // Use majority vote per family per hypothesis
    hypothesisVotes.get(v.hypothesis_id)!.set(v.model_family, v.vote);
  }

  // Compute pairwise agreement rates
  const families = [...new Set(allVotes.map(v => v.model_family))];
  const results: ModelAgreementEntry[] = [];

  for (let i = 0; i < families.length; i++) {
    for (let j = i + 1; j < families.length; j++) {
      const familyA = families[i]!;
      const familyB = families[j]!;
      let agree = 0;
      let total = 0;

      for (const [, familyVotes] of hypothesisVotes) {
        const voteA = familyVotes.get(familyA);
        const voteB = familyVotes.get(familyB);
        if (voteA && voteB) {
          total++;
          if (voteA === voteB) agree++;
        }
      }

      if (total > 0) {
        results.push({
          family_a: familyA,
          family_b: familyB,
          agreement_rate: Math.round((agree / total) * 100) / 100,
          sample_size: total,
        });
      }
    }
  }

  const sorted = results.sort((a, b) => b.agreement_rate - a.agreement_rate);
  void setCache(AGREEMENT_MATRIX_CACHE_KEY, sorted, AGREEMENT_MATRIX_TTL_MS);
  return sorted;
}
