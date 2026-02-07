import { NextRequest } from 'next/server';
import { getActiveChallenges, getRecentChallenges } from '@/lib/db-supabase';
import { success, handleApiError, ValidationError } from '@/lib/api-utils';

const VALID_STATUSES = [
  'formation',
  'exploration',
  'adversarial',
  'synthesis',
  'published',
  'archived',
] as const;

/**
 * GET /api/challenges
 * Returns active challenges and recent challenges list.
 * Query params: status (filter), limit (max 50), cursor (ISO8601)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
    const cursor = searchParams.get('cursor') || undefined;

    if (statusParam && !VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])) {
      throw new ValidationError(
        `Invalid status: ${statusParam}. Must be one of: ${VALID_STATUSES.join(', ')}`
      );
    }

    const [active, challenges] = await Promise.all([
      getActiveChallenges(),
      getRecentChallenges(limit, statusParam, cursor),
    ]);

    const lastChallenge = challenges[challenges.length - 1];
    return success({
      active,
      challenges,
      next_cursor: lastChallenge?.created_at ?? null,
      has_more: challenges.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
