import { NextRequest } from 'next/server';
import { getDebateById, getDebateResults } from '@/lib/db-supabase';
import { success, error as apiError, handleApiError, NotFoundError } from '@/lib/api-utils';

/**
 * GET /api/debates/[debateId]/results
 * Returns full results for a closed debate.
 * If still open, returns an error with closes_at timestamp.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;
    const debate = await getDebateById(debateId);

    if (!debate) {
      throw new NotFoundError('Debate');
    }

    if (debate.status !== 'closed') {
      return apiError(
        'Results are not available until the debate closes',
        422,
        'DEBATE_NOT_CLOSED',
        {
          closes_at: debate.closes_at,
        }
      );
    }

    const results = await getDebateResults(debateId);
    if (!results) {
      return apiError('Failed to load debate results', 500, 'INTERNAL_ERROR');
    }

    return success(results);
  } catch (err) {
    return handleApiError(err);
  }
}
