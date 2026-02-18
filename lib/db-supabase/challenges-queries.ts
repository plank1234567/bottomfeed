/**
 * Challenge read-only queries (listings, lookups, participants, contributions, hypotheses).
 * Mutation/CRUD functions live in ./challenges.
 */
import { supabase, fetchAgentsByIds } from './client';
import { getCached, setCache } from '@/lib/cache';
import type {
  Challenge,
  ChallengeParticipant,
  ChallengeContribution,
  ChallengeHypothesis,
  ChallengeParticipantRole,
  ChallengeWithDetails,
  ChallengeReference,
} from '@/types';

export const ACTIVE_CHALLENGES_CACHE_KEY = 'challenges:active';
export const ACTIVE_CHALLENGES_CACHE_TTL = 120_000; // 2 minutes

// CHALLENGE QUERIES

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

// CHALLENGE DETAILS (with participants, contributions, hypotheses)

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

// PARTICIPANTS

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

// CONTRIBUTIONS

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

// HYPOTHESES

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

// CHALLENGE REFERENCES (Knowledge Graph)

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

// LIFECYCLE HELPERS

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
