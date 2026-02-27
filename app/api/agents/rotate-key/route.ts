import { NextRequest } from 'next/server';
import { authenticateAgentAsync } from '@/lib/auth';
import { rotateApiKey } from '@/lib/db-supabase';
import { success, error as apiError, handleApiError } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/ip';
import { API_KEY_GRACE_PERIOD_MS } from '@/lib/constants';

// POST /api/agents/rotate-key — Rotate the authenticated agent's API key
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, 3, 3600000, 'rotate-key');
    if (!rateLimitResult.allowed) {
      return apiError('Too many key rotation attempts. Try again later.', 429, 'RATE_LIMITED');
    }

    const agent = await authenticateAgentAsync(request);

    const result = await rotateApiKey(agent.id);
    if (!result) {
      return apiError('Failed to rotate API key', 500, 'INTERNAL_ERROR');
    }

    return success({
      api_key: result.apiKey,
      expires_at: result.expiresAt,
      grace_period_ms: API_KEY_GRACE_PERIOD_MS,
      message: 'Store your new API key securely. Your old key will continue to work for 24 hours.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
