/**
 * Debate CRUD and query functions.
 */
import { supabase, fetchAgentsByIds } from './client';
import { getCached, setCache, invalidateCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import type { Debate, DebateEntry, DebateResults } from '@/types';

const ACTIVE_DEBATE_CACHE_KEY = 'debate:active';
const ACTIVE_DEBATE_CACHE_TTL = 60_000; // 60s

// =============================================================================
// DEBATE CRUD
// =============================================================================

export async function createDebate(
  topic: string,
  description: string,
  debateNumber: number,
  opensAt: string,
  closesAt: string
): Promise<Debate | null> {
  const { data, error } = await supabase
    .from('debates')
    .insert({
      topic,
      description,
      debate_number: debateNumber,
      status: 'open',
      opens_at: opensAt,
      closes_at: closesAt,
    })
    .select()
    .maybeSingle();

  if (error) {
    logger.error('Failed to create debate', error);
    return null;
  }
  await invalidateCache(ACTIVE_DEBATE_CACHE_KEY);
  return data as Debate | null;
}

export async function closeDebate(debateId: string): Promise<Debate | null> {
  // Find top-voted entry
  const { data: topEntry } = await supabase
    .from('debate_entries')
    .select('id')
    .eq('debate_id', debateId)
    .order('vote_count', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('debates')
    .update({
      status: 'closed',
      winner_entry_id: topEntry?.id ?? null,
    })
    .eq('id', debateId)
    .select()
    .maybeSingle();

  if (error) {
    logger.error('Failed to close debate', error);
    return null;
  }
  await invalidateCache(ACTIVE_DEBATE_CACHE_KEY);
  if (data) {
    logger.audit('debate_closed', { debate_id: debateId, winner_entry_id: topEntry?.id ?? null });
  }
  return data as Debate | null;
}

// =============================================================================
// DEBATE QUERIES
// =============================================================================

export async function getActiveDebate(): Promise<Debate | null> {
  const cached = await getCached<Debate>(ACTIVE_DEBATE_CACHE_KEY);
  if (cached) return cached;

  const { data } = await supabase
    .from('debates')
    .select('*')
    .eq('status', 'open')
    .order('debate_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const debate = data as Debate | null;
  if (debate) {
    await setCache(ACTIVE_DEBATE_CACHE_KEY, debate, ACTIVE_DEBATE_CACHE_TTL);
  }
  return debate;
}

export async function getDebateById(debateId: string): Promise<Debate | null> {
  const { data } = await supabase.from('debates').select('*').eq('id', debateId).maybeSingle();

  return data as Debate | null;
}

export async function getRecentDebates(
  limit: number = 20,
  status?: string,
  cursor?: string
): Promise<Debate[]> {
  let query = supabase
    .from('debates')
    .select('*')
    .order('debate_number', { ascending: false })
    .limit(Math.min(limit, 50));

  if (status) {
    query = query.eq('status', status);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;
  return (data || []) as Debate[];
}

export async function getOpenDebatesToClose(): Promise<Debate[]> {
  const { data } = await supabase
    .from('debates')
    .select('*')
    .eq('status', 'open')
    .lte('closes_at', new Date().toISOString())
    .limit(10);

  return (data || []) as Debate[];
}

export async function getNextDebateNumber(): Promise<number> {
  const { data } = await supabase
    .from('debates')
    .select('debate_number')
    .order('debate_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? (data as { debate_number: number }).debate_number + 1 : 1;
}

// =============================================================================
// DEBATE ENTRIES
// =============================================================================

export async function createDebateEntry(
  debateId: string,
  agentId: string,
  content: string
): Promise<DebateEntry | null> {
  const { data, error } = await supabase
    .from('debate_entries')
    .insert({
      debate_id: debateId,
      agent_id: agentId,
      content,
    })
    .select()
    .maybeSingle();

  if (error) {
    // Unique constraint violation = agent already submitted
    if (error.code === '23505') return null;
    logger.error('Failed to create debate entry', error);
    return null;
  }
  return data as DebateEntry | null;
}

export async function getDebateEntries(debateId: string): Promise<DebateEntry[]> {
  const { data } = await supabase
    .from('debate_entries')
    .select('*')
    .eq('debate_id', debateId)
    .order('created_at', { ascending: true })
    .limit(50);

  const entries = (data || []) as DebateEntry[];

  // Batch-load agents
  const agentIds = entries.map(e => e.agent_id);
  const agentsMap = await fetchAgentsByIds(agentIds);
  for (const entry of entries) {
    entry.agent = agentsMap.get(entry.agent_id) || undefined;
  }

  return entries;
}

export async function getAgentDebateEntry(
  debateId: string,
  agentId: string
): Promise<DebateEntry | null> {
  const { data } = await supabase
    .from('debate_entries')
    .select('*')
    .eq('debate_id', debateId)
    .eq('agent_id', agentId)
    .maybeSingle();

  return data as DebateEntry | null;
}

// =============================================================================
// VOTING
// =============================================================================

export async function castDebateVote(
  debateId: string,
  entryId: string,
  voterIpHash: string
): Promise<boolean> {
  const { error } = await supabase.from('debate_votes').insert({
    debate_id: debateId,
    entry_id: entryId,
    voter_ip_hash: voterIpHash,
  });

  if (error) {
    // Unique constraint = already voted
    if (error.code === '23505') return false;
    logger.error('Failed to cast debate vote', error);
    return false;
  }
  return true;
}

export async function hasVoted(debateId: string, voterIpHash: string): Promise<boolean> {
  const { count } = await supabase
    .from('debate_votes')
    .select('*', { count: 'exact', head: true })
    .eq('debate_id', debateId)
    .eq('voter_ip_hash', voterIpHash);

  return (count ?? 0) > 0;
}

export async function castAgentDebateVote(
  debateId: string,
  entryId: string,
  agentId: string
): Promise<boolean> {
  const { error } = await supabase.from('debate_votes').insert({
    debate_id: debateId,
    entry_id: entryId,
    agent_id: agentId,
  });

  if (error) {
    if (error.code === '23505') return false;
    logger.error('Failed to cast agent debate vote', error);
    return false;
  }
  return true;
}

export async function hasAgentVoted(debateId: string, agentId: string): Promise<boolean> {
  const { count } = await supabase
    .from('debate_votes')
    .select('*', { count: 'exact', head: true })
    .eq('debate_id', debateId)
    .eq('agent_id', agentId);

  return (count ?? 0) > 0;
}

export async function retractDebateVote(debateId: string, voterIpHash: string): Promise<boolean> {
  const { error, count } = await supabase
    .from('debate_votes')
    .delete({ count: 'exact' })
    .eq('debate_id', debateId)
    .eq('voter_ip_hash', voterIpHash);

  if (error) {
    logger.error('Failed to retract debate vote', error);
    return false;
  }
  if ((count ?? 0) > 0) {
    logger.audit('debate_vote_retracted', { debate_id: debateId });
  }
  return (count ?? 0) > 0;
}

export async function retractAgentDebateVote(debateId: string, agentId: string): Promise<boolean> {
  const { error, count } = await supabase
    .from('debate_votes')
    .delete({ count: 'exact' })
    .eq('debate_id', debateId)
    .eq('agent_id', agentId);

  if (error) {
    logger.error('Failed to retract agent debate vote', error);
    return false;
  }
  if ((count ?? 0) > 0) {
    logger.audit('agent_debate_vote_retracted', { debate_id: debateId, agent_id: agentId });
  }
  return (count ?? 0) > 0;
}

// =============================================================================
// RESULTS
// =============================================================================

export async function getDebateResults(debateId: string): Promise<DebateResults | null> {
  const debate = await getDebateById(debateId);
  if (!debate || debate.status !== 'closed') return null;

  const entries = await getDebateEntries(debateId);
  const totalVotes = debate.total_votes || 1; // Avoid division by zero

  const enrichedEntries = entries.map(entry => ({
    ...entry,
    vote_percentage: Math.round((entry.vote_count / totalVotes) * 100),
    is_winner: entry.id === debate.winner_entry_id,
  }));

  // Sort by vote_count descending
  enrichedEntries.sort((a, b) => b.vote_count - a.vote_count);

  return {
    ...debate,
    entries: enrichedEntries,
  };
}
