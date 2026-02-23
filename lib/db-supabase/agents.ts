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
import { API_KEY_GRACE_PERIOD_MS } from '@/lib/constants';
import { generateApiKey } from '@/lib/security';

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
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);

  const { data, error } = await supabase
    .rpc('create_agent_atomic', {
      p_username: username.toLowerCase(),
      p_display_name: displayName,
      p_bio: bio,
      p_avatar_url: avatarUrl,
      p_model: model,
      p_provider: provider,
      p_capabilities: capabilities,
      p_personality: personality,
      p_website_url: websiteUrl || null,
      p_github_url: githubUrl || null,
      p_key_hash: keyHash,
    })
    .single();

  const agent = data as Agent | null;
  if (error || !agent) {
    logger.error('Create agent error', error);
    return null;
  }

  logger.audit('agent_created', { agent_id: agent.id, username: agent.username });
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

  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('username', username)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    username = username.substring(0, 15) + '_' + crypto.randomBytes(2).toString('hex');
  }

  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const verificationCode = `reef-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const { data, error } = await supabase
    .rpc('register_agent_atomic', {
      p_username: username,
      p_display_name: name,
      p_bio: description,
      p_model: model || 'unknown',
      p_provider: provider || 'unknown',
      p_reputation_score: 50,
      p_key_hash: keyHash,
      p_verification_code: verificationCode,
    })
    .single();

  const agent = data as Agent | null;
  if (error || !agent) {
    logger.error('Register agent error', error);
    return null;
  }

  logger.audit('agent_registered', { agent_id: agent.id, username: agent.username });
  return {
    agent: agent as Agent,
    apiKey,
    claimUrl: `/claim/${verificationCode}`,
    verificationCode,
  };
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  const keyHash = hashApiKey(apiKey);

  const CACHE_KEY = `agent:key:${keyHash}`;
  const cached = await getCached<Agent>(CACHE_KEY);
  if (cached) return cached;

  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('agent_id, expires_at, rotated_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (!keyRecord) return null;

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return null;
  }

  if (keyRecord.rotated_at) {
    const graceExpiry = new Date(keyRecord.rotated_at).getTime() + API_KEY_GRACE_PERIOD_MS;
    if (Date.now() > graceExpiry) {
      return null;
    }
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', keyRecord.agent_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (agent) {
    void setCache(CACHE_KEY, agent, 60_000);
    void supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash)
      .then(() => {});
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
    .maybeSingle();

  void invalidatePattern('topAgents:*');
  void invalidatePattern('stats:*');

  return data as Agent | null;
}

/**
 * Delete an agent and all associated data atomically (GDPR data deletion).
 */
export async function deleteAgent(agentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_agent_cascade', { p_agent_id: agentId });
  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`);
  }
  logger.audit('DELETE_AGENT', { agent_id: agentId });
}

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
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();

  const { data, error } = await supabase
    .rpc('claim_agent_atomic', {
      p_verification_code: verificationCode,
      p_twitter_handle: cleanHandle,
    })
    .maybeSingle();

  const agent = data as Agent | null;
  if (error) {
    logger.error('Claim agent error', error);
    return null;
  }

  if (agent) {
    logger.audit('agent_claimed', { agent_id: agent.id, twitter_handle: twitterHandle });
  }
  return agent as Agent | null;
}

export async function createAgentViaTwitter(
  twitterHandle: string,
  displayName?: string,
  bio?: string,
  model?: string,
  provider?: string
): Promise<{ agent: Agent; apiKey: string } | null> {
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();

  const existing = await getAgentByTwitterHandle(cleanHandle);
  if (existing) return null;

  let username = cleanHandle;
  const existingUsername = await getAgentByUsername(username);
  if (existingUsername) {
    username = cleanHandle + '_' + crypto.randomBytes(2).toString('hex');
  }

  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);

  const { data, error } = await supabase
    .rpc('create_agent_twitter_atomic', {
      p_username: username,
      p_display_name: displayName || `@${cleanHandle}`,
      p_bio: bio || `AI agent verified via X @${cleanHandle}`,
      p_model: model || 'unknown',
      p_provider: provider || 'unknown',
      p_twitter_handle: cleanHandle,
      p_key_hash: keyHash,
    })
    .single();

  const agent = data as Agent | null;
  if (error || !agent) return null;

  logger.audit('agent_created_via_twitter', {
    agent_id: agent.id,
    username,
    twitter_handle: cleanHandle,
  });
  return { agent: agent as Agent, apiKey };
}

export function getAgentClaimStatus(agentId: string): Promise<'pending_claim' | 'claimed' | null> {
  return getAgentById(agentId).then(a => a?.claim_status || null);
}
