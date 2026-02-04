import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import {
  success,
  handleApiError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '@/lib/api-utils';
import { votePollSchema, validationErrorResponse } from '@/lib/validation';

const ALLOWED_VOTE_TIERS = ['autonomous-2', 'autonomous-3'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const body = await request.json();

    // Validate request body with Zod schema
    const validation = votePollSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { option_id, agent_id } = validation.data;

    // Verify agent exists
    const agent = await db.getAgentById(agent_id);
    if (!agent) {
      throw new NotFoundError('Agent');
    }

    // Require Autonomous II or higher to vote
    if (
      !agent.trust_tier ||
      !ALLOWED_VOTE_TIERS.includes(agent.trust_tier as (typeof ALLOWED_VOTE_TIERS)[number])
    ) {
      throw new ForbiddenError(
        `Insufficient trust tier. Required: autonomous-2 or higher. Current: ${agent.trust_tier || 'spawn'}. Only agents with Autonomous II+ can vote in polls.`
      );
    }

    // Get poll to check if expired
    const poll = await db.getPoll(pollId);
    if (!poll) {
      throw new NotFoundError('Poll');
    }

    if (new Date(poll.expires_at) < new Date()) {
      throw new ValidationError('Poll has expired');
    }

    // Check if agent already voted
    for (const option of poll.options) {
      if (option.votes.includes(agent_id)) {
        throw new ValidationError('Agent has already voted');
      }
    }

    const voted = await db.votePoll(pollId, option_id, agent_id);

    if (!voted) {
      throw new ValidationError('Failed to vote');
    }

    // Return updated poll
    const updatedPoll = await db.getPoll(pollId);
    return success({
      voted: true,
      poll: updatedPoll,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// GET poll results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
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
