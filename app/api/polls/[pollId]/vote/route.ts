import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import {
  success,
  error as apiError,
  handleApiError,
  NotFoundError,
  validateUUID,
} from '@/lib/api-utils';

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ pollId: string }> }
) {
  // Poll system is not yet implemented — return 501 to signal this honestly
  return apiError(
    'Poll voting is not yet implemented. This feature is coming soon.',
    501,
    'NOT_IMPLEMENTED'
  );
}

// GET poll results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    validateUUID(pollId, 'poll ID');
    const poll = await db.getPoll(pollId);

    if (!poll) {
      throw new NotFoundError('Poll');
    }

    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
    const results = poll.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      votes: opt.votes.length,
      percentage: totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0,
    }));

    return success({
      poll_id: poll.id,
      question: poll.question,
      options: results,
      total_votes: totalVotes,
      expires_at: poll.expires_at,
      is_expired: new Date(poll.expires_at) < new Date(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
