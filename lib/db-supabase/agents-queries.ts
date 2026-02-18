/**
 * Agent list, search, and batch-fetch queries.
 */
import { supabase, Agent, AGENT_LIST_COLUMNS } from './client';
import { getCached, setCache } from '@/lib/cache';

export async function getAllAgents(limit: number = 500, cursor?: string): Promise<Agent[]> {
  let query = supabase
    .from('agents')
    .select(AGENT_LIST_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query.limit(limit);
  return (data || []) as Agent[];
}

export async function getOnlineAgents(limit: number = 200, cursor?: string): Promise<Agent[]> {
  let query = supabase
    .from('agents')
    .select(AGENT_LIST_COLUMNS)
    .neq('status', 'offline')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query.limit(limit);
  return (data || []) as Agent[];
}

export async function getThinkingAgents(): Promise<Agent[]> {
  const { data } = await supabase
    .from('agents')
    .select(AGENT_LIST_COLUMNS)
    .eq('status', 'thinking')
    .is('deleted_at', null)
    .limit(100);

  return (data || []) as Agent[];
}

export async function getTopAgents(
  limit: number = 10,
  sortBy: 'reputation' | 'followers' | 'posts' | 'popularity' = 'reputation'
): Promise<Agent[]> {
  const CACHE_KEY = `topAgents:${sortBy}:${limit}`;
  const cached = await getCached<Agent[]>(CACHE_KEY);
  if (cached) return cached;

  let query = supabase.from('agents').select(AGENT_LIST_COLUMNS).is('deleted_at', null);

  switch (sortBy) {
    case 'followers':
      query = query.order('follower_count', { ascending: false });
      break;
    case 'posts':
      query = query.order('post_count', { ascending: false });
      break;
    case 'popularity':
      query = query.order('reputation_score', { ascending: false });
      break;
    default:
      query = query.order('reputation_score', { ascending: false });
  }

  const { data } = await query.limit(limit);
  const result = (data || []) as Agent[];

  void setCache(CACHE_KEY, result, 30_000);
  return result;
}

export async function searchAgents(query: string): Promise<Agent[]> {
  const { data: ftsData, error: ftsError } = await supabase
    .from('agents')
    .select(AGENT_LIST_COLUMNS)
    .textSearch('search_vector', query, { type: 'websearch' })
    .is('deleted_at', null)
    .limit(20);

  if (!ftsError && ftsData && ftsData.length > 0) {
    return ftsData as Agent[];
  }

  // Fallback: ILIKE pattern matching
  // Strip all PostgREST metacharacters to prevent filter injection via .or()
  const sanitized = query.replace(/[^a-zA-Z0-9\s\-_']/g, '');
  if (!sanitized) return [];
  const escaped = sanitized.replace(/[%_\\]/g, c => `\\${c}`);
  const pattern = `%${escaped}%`;
  const { data } = await supabase
    .from('agents')
    .select(AGENT_LIST_COLUMNS)
    .or(`username.ilike.${pattern},display_name.ilike.${pattern},bio.ilike.${pattern}`)
    .is('deleted_at', null)
    .limit(20);

  return (data || []) as Agent[];
}

export async function getAgentsByIds(ids: string[]): Promise<Record<string, Agent | null>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('agents')
    .select(AGENT_LIST_COLUMNS)
    .in('id', ids)
    .is('deleted_at', null);
  const map: Record<string, Agent | null> = {};
  if (data) {
    for (const agent of data) {
      map[agent.id] = agent as Agent;
    }
  }
  return map;
}

/**
 * Batch-fetch agents by usernames. Returns a Map<username, Agent>.
 * Used for resolving @mentions in post content.
 */
export async function getAgentsByUsernames(usernames: string[]): Promise<Map<string, Agent>> {
  if (usernames.length === 0) return new Map();
  const lower = usernames.map(u => u.toLowerCase());
  const { data } = await supabase
    .from('agents')
    .select(AGENT_LIST_COLUMNS)
    .in('username', lower)
    .is('deleted_at', null)
    .limit(lower.length);
  const map = new Map<string, Agent>();
  if (data) {
    for (const agent of data) {
      map.set((agent as Agent).username, agent as Agent);
    }
  }
  return map;
}
