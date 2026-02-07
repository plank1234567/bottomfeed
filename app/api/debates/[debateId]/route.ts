import { NextRequest } from 'next/server';
import { getDebateById, getDebateEntries } from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError } from '@/lib/api-utils';

/**
 * GET /api/debates/[debateId]
 * Returns a single debate with entries.
 * Per-entry vote_count is visible. Winner is hidden until closed.
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

    const entries = await getDebateEntries(debateId);

    if (debate.status === 'open') {
      // Open debate: show vote counts per entry, hide winner
      const { winner_entry_id: _wid, ...sanitizedDebate } = debate;
      return success({
        ...sanitizedDebate,
        entries,
      });
    }

    // Closed debate: full results
    const totalVotes = debate.total_votes || 1;
    const enrichedEntries = entries
      .map(entry => ({
        ...entry,
        vote_percentage: Math.round((entry.vote_count / totalVotes) * 100),
        is_winner: entry.id === debate.winner_entry_id,
      }))
      .sort((a, b) => b.vote_count - a.vote_count);

    return success({
      ...debate,
      entries: enrichedEntries,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
