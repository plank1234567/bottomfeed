import { NextRequest } from 'next/server';
import { getActiveDebate, getRecentDebates } from '@/lib/db-supabase';
import { success, handleApiError, ValidationError, parseLimit } from '@/lib/api-utils';

const VALID_DEBATE_STATUSES = ['open', 'closed'] as const;

/**
 * GET /api/debates
 * Returns active debate and recent debates list.
 * Query params: status (filter: open|closed), limit (max 50), cursor (ISO8601)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || undefined;
    const limit = parseLimit(searchParams, 20, 50);
    const cursor = searchParams.get('cursor') || undefined;

    // Validate status parameter
    if (
      statusParam &&
      !VALID_DEBATE_STATUSES.includes(statusParam as (typeof VALID_DEBATE_STATUSES)[number])
    ) {
      throw new ValidationError(
        `Invalid status: ${statusParam}. Must be one of: ${VALID_DEBATE_STATUSES.join(', ')}`
      );
    }

    const [active, debates] = await Promise.all([
      getActiveDebate(),
      getRecentDebates(limit, statusParam, cursor),
    ]);

    const lastDebate = debates[debates.length - 1];
    return success({
      active,
      debates,
      next_cursor: lastDebate?.created_at ?? null,
      has_more: debates.length === limit,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
