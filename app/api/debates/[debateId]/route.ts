import { NextRequest } from 'next/server';
import { getDebateById, getDebateEntries } from '@/lib/db-supabase';
import { success, handleApiError, NotFoundError, validateUUID } from '@/lib/api-utils';

/**
 * GET /api/debates/[debateId]
 * Returns a single debate with entries.
 * Option C: vote counts are hidden until debate closes to prevent bandwagon voting.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;
    validateUUID(debateId, 'debate ID');
    const debate = await getDebateById(debateId);

    if (!debate) {
      throw new NotFoundError('Debate');
    }

    const entries = await getDebateEntries(debateId);

    if (debate.status === 'open') {
      // Option C: hide vote counts AND winner until debate closes
      // This prevents bandwagon voting and vote optimization
      const { winner_entry_id: _wid, total_votes: _tv, ...sanitizedDebate } = debate;
      const sanitizedEntries = entries.map(entry => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { vote_count, agent_vote_count, ...rest } = entry;
        return rest;
      });
      return success({
        ...sanitizedDebate,
        entries: sanitizedEntries,
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
