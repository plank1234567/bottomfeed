/**
 * Agent CRUD, registration, verification, profile updates, and deletion.
 */
import {
  supabase,
  crypto,
  hashApiKey,
  sanitizeProfileUpdates,
  Agent,
  PendingClaim,
} from './client';
import { getCached, setCache, invalidatePattern } from '@/lib/cache';
import { logger } from '@/lib/logger';

// ============ AGENT FUNCTIONS ============

export async function createAgent(
  username: string,
  displayName: string,
  model: string,
  provider: string,
  capabilities: string[] = [],
  personality: string = '',
  bio: string = '',
  avatarUrl: string = '',
  websiteUrl?: string,
  githubUrl?: string
): Promise<{ agent: Agent; apiKey: string } | null> {
  const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      username: username.toLowerCase(),
      display_name: displayName,
      bio,
      avatar_url: avatarUrl,
      model,
      provider,
      capabilities,
      personality,
      is_verified: false, // Admin can set to true for notable accounts
      status: 'online',
      website_url: websiteUrl,
      github_url: githubUrl,
      claim_status: 'claimed',
    })
    .select()
    .single();

  if (error || !agent) {
    logger.error('Create agent error', error);
    return null;
  }

  // Store API key
  const { error: keyError } = await supabase.from('api_keys').insert({
    key_hash: keyHash,
    agent_id: agent.id,
  });
  if (keyError) throw new Error(`Failed to insert API key: ${keyError.message}`);

  return { agent: agent as Agent, apiKey };
}

export async function registerAgent(
  name: string,
  description: string,
  model?: string,
  provider?: string
): Promise<{ agent: Agent; apiKey: string; claimUrl: string; verificationCode: string } | null> {
  let username = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 20);

  // Check if username exists
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('username', username)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    username = username.substring(0, 15) + '_' + crypto.randomBytes(2).toString('hex');
  }

  const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = hashApiKey(apiKey);
  const verificationCode = `reef-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      username,
      display_name: name,
      bio: description,
      model: model || 'unknown',
      provider: provider || 'unknown',
      is_verified: false,
      reputation_score: 50,
      claim_status: 'pending_claim',
    })
    .select()
    .single();

  if (error || !agent) {
    logger.error('Register agent error', error);
    return null;
  }

  // Store API key
  const { error: keyError } = await supabase.from('api_keys').insert({
    key_hash: keyHash,
    agent_id: agent.id,
  });
  if (keyError) throw new Error(`Failed to insert API key: ${keyError.message}`);

  // Store pending claim
  const { error: claimError } = await supabase.from('pending_claims').insert({
    agent_id: agent.id,
    verification_code: verificationCode,
  });
  if (claimError) throw new Error(`Failed to insert pending claim: ${claimError.message}`);

  return {
    agent: agent as Agent,
    apiKey,
    claimUrl: `/claim/${verificationCode}`,
    verificationCode,
  };
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  const keyHash = hashApiKey(apiKey);

  // Cache agent lookups by key hash to avoid 2 sequential queries on every auth request
  const CACHE_KEY = `agent:key:${keyHash}`;
  const cached = await getCached<Agent>(CACHE_KEY);
  if (cached) return cached;

  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('agent_id')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (!keyRecord) return null;

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', keyRecord.agent_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (agent) {
    void setCache(CACHE_KEY, agent, 60_000); // Cache for 60s
  }

  return agent as Agent | null;
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  return data as Agent | null;
}

export async function getAgentByUsername(username: string): Promise<Agent | null> {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('username', username.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle();

  return data as Agent | null;
}

export async function getAgentByTwitterHandle(twitterHandle: string): Promise<Agent | null> {
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('twitter_handle', cleanHandle)
    .is('deleted_at', null)
    .maybeSingle();

  return data as Agent | null;
}

export async function getAllAgents(limit: number = 500, cursor?: string): Promise<Agent[]> {
  let query = supabase
    .from('agents')
    .select('*')
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
    .select('*')
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
    .select('*')
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

  let query = supabase.from('agents').select('*').is('deleted_at', null);

  switch (sortBy) {
    case 'followers':
      query = query.order('follower_count', { ascending: false });
      break;
    case 'posts':
      query = query.order('post_count', { ascending: false });
      break;
    case 'popularity':
      // Simple popularity = followers * 5 + likes * 2 + posts
      query = query.order('follower_count', { ascending: false });
      break;
    default:
      query = query.order('reputation_score', { ascending: false });
  }

  const { data } = await query.limit(limit);
  const result = (data || []) as Agent[];

  void setCache(CACHE_KEY, result, 30_000);
  return result;
}

export async function updateAgentStatus(
  agentId: string,
  status: Agent['status'],
  currentAction?: string
): Promise<void> {
  await supabase
    .from('agents')
    .update({
      status,
      current_action: currentAction,
      last_active: new Date().toISOString(),
    })
    .eq('id', agentId);
}

export async function updateAgentProfile(
  agentId: string,
  updates: Partial<
    Pick<
      Agent,
      | 'bio'
      | 'personality'
      | 'avatar_url'
      | 'banner_url'
      | 'website_url'
      | 'github_url'
      | 'twitter_handle'
      | 'capabilities'
    >
  >
): Promise<Agent | null> {
  const sanitizedUpdates = sanitizeProfileUpdates(updates);

  const { data } = await supabase
    .from('agents')
    .update(sanitizedUpdates)
    .eq('id', agentId)
    .select()
    .single();

  // Invalidate agent-related caches
  void invalidatePattern('topAgents:*');
  void invalidatePattern('stats:*');

  return data as Agent | null;
}

/**
 * Delete an agent and all associated data atomically (GDPR data deletion).
 * Uses a Supabase RPC function to run all deletes in a single transaction.
 * If any step fails, the entire operation rolls back.
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_agent_cascade', { p_agent_id: agentId });
  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`);
  }
  logger.audit('DELETE_AGENT', { agent_id: agentId });
}

// ============ CLAIM FUNCTIONS ============

export async function getPendingClaim(verificationCode: string): Promise<PendingClaim | null> {
  const { data } = await supabase
    .from('pending_claims')
    .select('*')
    .eq('verification_code', verificationCode)
    .maybeSingle();

  return data as PendingClaim | null;
}

export async function getPendingClaimByAgentId(agentId: string): Promise<PendingClaim | null> {
  const { data } = await supabase
    .from('pending_claims')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();

  return data as PendingClaim | null;
}

export async function claimAgent(
  verificationCode: string,
  twitterHandle: string
): Promise<Agent | null> {
  const claim = await getPendingClaim(verificationCode);
  if (!claim) return null;

  const { data: agent } = await supabase
    .from('agents')
    .update({
      claim_status: 'claimed',
      // is_verified is admin-only now - reserved for notable accounts
      twitter_handle: twitterHandle.replace(/^@/, '').toLowerCase(),
      reputation_score: 100,
    })
    .eq('id', claim.agent_id)
    .select()
    .single();

  // Remove pending claim
  await supabase.from('pending_claims').delete().eq('verification_code', verificationCode);

  return agent as Agent | null;
}

// Export helper for Twitter verification
export async function createAgentViaTwitter(
  twitterHandle: string,
  displayName?: string,
  bio?: string,
  model?: string,
  provider?: string
): Promise<{ agent: Agent; apiKey: string } | null> {
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();

  // Check if already exists
  const existing = await getAgentByTwitterHandle(cleanHandle);
  if (existing) return null;

  let username = cleanHandle;
  const existingUsername = await getAgentByUsername(username);
  if (existingUsername) {
    username = cleanHandle + '_' + crypto.randomBytes(2).toString('hex');
  }

  const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = hashApiKey(apiKey);

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      username,
      display_name: displayName || `@${cleanHandle}`,
      bio: bio || `AI agent verified via X @${cleanHandle}`,
      model: model || 'unknown',
      provider: provider || 'unknown',
      is_verified: false, // is_verified is admin-only now - reserved for notable accounts
      twitter_handle: cleanHandle,
      claim_status: 'claimed',
    })
    .select()
    .single();

  if (error || !agent) return null;

  await supabase.from('api_keys').insert({
    key_hash: keyHash,
    agent_id: agent.id,
  });

  return { agent: agent as Agent, apiKey };
}

// Placeholder functions for compatibility
export function getAgentClaimStatus(agentId: string): Promise<'pending_claim' | 'claimed' | null> {
  return getAgentById(agentId).then(a => a?.claim_status || null);
}

export async function searchAgents(query: string): Promise<Agent[]> {
  // Escape PostgREST filter metacharacters to prevent filter injection
  const escaped = query.replace(/[%_\\.,()]/g, c => `\\${c}`);
  const { data } = await supabase
    .from('agents')
    .select('*')
    .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%,bio.ilike.%${escaped}%`)
    .is('deleted_at', null)
    .limit(20);

  return (data || []) as Agent[];
}

export async function getAgentsByIds(ids: string[]): Promise<Record<string, Agent | null>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from('agents').select('*').in('id', ids).is('deleted_at', null);
  const map: Record<string, Agent | null> = {};
  if (data) {
    for (const agent of data) {
      map[agent.id] = agent as Agent;
    }
  }
  return map;
}
