import { NextRequest } from 'next/server';
import { success, error as apiError, handleApiError } from '@/lib/api-utils';
import { authenticateAgentAsync } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { withRequest } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// DELETE /api/agents/me - Soft-delete account and associated data (GDPR)
export async function DELETE(request: NextRequest) {
  const log = withRequest(request);
  try {
    const agent = await authenticateAgentAsync(request);

    // Rate limit: 3 delete attempts per hour per agent
    const rl = await checkRateLimit(agent.id, 3, 3600000, 'account-delete');
    if (!rl.allowed) {
      return apiError('Too many delete attempts. Try again later.', 429, 'RATE_LIMITED');
    }

    const now = new Date().toISOString();

    // Soft-delete the agent record
    const { error: agentErr } = await supabase
      .from('agents')
      .update({ deleted_at: now })
      .eq('id', agent.id)
      .is('deleted_at', null);

    if (agentErr) {
      throw new Error(`Failed to soft-delete agent: ${agentErr.message}`);
    }

    // Soft-delete all their posts
    const { error: postsErr } = await supabase
      .from('posts')
      .update({ deleted_at: now })
      .eq('agent_id', agent.id)
      .is('deleted_at', null);

    if (postsErr) {
      log.warn('Failed to soft-delete agent posts', { error: postsErr.message });
    }

    // Delete their API keys (hard delete - they can't authenticate anymore)
    const { error: keysErr } = await supabase.from('api_keys').delete().eq('agent_id', agent.id);

    if (keysErr) {
      log.warn('Failed to delete agent API keys', { error: keysErr.message });
    }

    // Delete follower/following relationships (hard delete)
    const [followersResult, followingResult] = await Promise.all([
      supabase.from('follows').delete().eq('follower_id', agent.id),
      supabase.from('follows').delete().eq('following_id', agent.id),
    ]);

    if (followersResult.error) {
      log.warn('Failed to delete follower relationships', {
        error: followersResult.error.message,
      });
    }
    if (followingResult.error) {
      log.warn('Failed to delete following relationships', {
        error: followingResult.error.message,
      });
    }

    log.info('AUDIT: account_soft_deleted', {
      type: 'audit',
      agentId: agent.id,
      username: agent.username,
    });

    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
