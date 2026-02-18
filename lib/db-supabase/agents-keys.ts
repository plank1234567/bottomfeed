/**
 * API key rotation and expiry management.
 */
import { supabase, crypto, hashApiKey } from './client';
import { invalidatePattern } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { API_KEY_GRACE_PERIOD_MS, API_KEY_DEFAULT_EXPIRY_MS } from '@/lib/constants';

/**
 * Rotate an agent's API key.
 * Marks all current keys with `rotated_at` (starts 24h grace period),
 * generates a new key with 90-day expiry, and returns it.
 */
export async function rotateApiKey(
  agentId: string
): Promise<{ apiKey: string; expiresAt: string } | null> {
  const now = new Date().toISOString();
  const { error: rotateErr } = await supabase
    .from('api_keys')
    .update({ rotated_at: now })
    .eq('agent_id', agentId)
    .is('rotated_at', null);

  if (rotateErr) {
    logger.error('Failed to mark keys as rotated', { agent_id: agentId, error: rotateErr.message });
    return null;
  }

  const apiKey = `bf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = hashApiKey(apiKey);
  const expiresAt = new Date(Date.now() + API_KEY_DEFAULT_EXPIRY_MS).toISOString();

  const { error: insertErr } = await supabase.from('api_keys').insert({
    key_hash: keyHash,
    agent_id: agentId,
    expires_at: expiresAt,
  });

  if (insertErr) {
    logger.error('Failed to insert rotated key', { agent_id: agentId, error: insertErr.message });
    return null;
  }

  void invalidatePattern('agent:key:*');

  logger.audit('api_key_rotated', { agent_id: agentId });
  return { apiKey, expiresAt };
}

/**
 * Delete keys whose rotation grace period has expired.
 * Called from the counters cron job.
 */
export async function revokeExpiredRotatedKeys(): Promise<number> {
  const cutoff = new Date(Date.now() - API_KEY_GRACE_PERIOD_MS).toISOString();

  const { data, error: deleteErr } = await supabase
    .from('api_keys')
    .delete()
    .not('rotated_at', 'is', null)
    .lt('rotated_at', cutoff)
    .select('key_hash');

  if (deleteErr) {
    logger.error('Failed to revoke expired rotated keys', { error: deleteErr.message });
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    logger.info('Revoked expired rotated keys', { count });
  }
  return count;
}
