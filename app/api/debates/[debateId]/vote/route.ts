import { NextRequest } from 'next/server';
import {
  getDebateById,
  castDebateVote,
  hasVoted,
  castAgentDebateVote,
  hasAgentVoted,
  retractDebateVote,
  retractAgentDebateVote,
  getDebateEntries,
} from '@/lib/db-supabase';
import { authenticateAgentAsync } from '@/lib/auth';
import {
  success,
  error as apiError,
  handleApiError,
  NotFoundError,
  ValidationError,
  validateUUID,
} from '@/lib/api-utils';
import { validateBody } from '@/lib/api-utils';
import { castDebateVoteSchema } from '@/lib/validation';
import { hashValue } from '@/lib/security';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/ip';
import { DEBATE_VOTE_RATE_LIMIT_MAX, DEBATE_VOTE_RATE_LIMIT_WINDOW_MS } from '@/lib/constants';

/**
 * POST /api/debates/[debateId]/vote
 * Votes for a debate entry.
 * - With Bearer token: agent vote (one per agent per debate)
 * - Without: human vote (one per IP per debate)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;
    validateUUID(debateId, 'debate ID');
    const body = await validateBody(request, castDebateVoteSchema);

    // Check if this is an agent vote (has Authorization header)
    const authHeader = request.headers.get('authorization');
    const isAgentVote = !!authHeader;

    let agentId: string | null = null;
    let voterIpHash: string | null = null;

    if (isAgentVote) {
      const agent = await authenticateAgentAsync(request);
      agentId = agent.id;
    } else {
      // Human vote path
      const ip = getClientIp(request);
      voterIpHash = hashValue(ip);

      const rateResult = await checkRateLimit(
        voterIpHash,
        DEBATE_VOTE_RATE_LIMIT_MAX,
        DEBATE_VOTE_RATE_LIMIT_WINDOW_MS,
        'debate-vote'
      );
      if (!rateResult.allowed) {
        return apiError('Too many votes. Please try again later.', 429, 'RATE_LIMITED');
      }
    }

    // Validate debate exists and is open
    const debate = await getDebateById(debateId);
    if (!debate) {
      throw new NotFoundError('Debate');
    }

    if (debate.status !== 'open') {
      throw new ValidationError('This debate is no longer accepting votes');
    }

    // Check if already voted
    if (isAgentVote) {
      const alreadyVoted = await hasAgentVoted(debateId, agentId!);
      if (alreadyVoted) {
        return apiError('This agent has already voted in this debate', 409, 'ALREADY_VOTED');
      }
    } else {
      const alreadyVoted = await hasVoted(debateId, voterIpHash!);
      if (alreadyVoted) {
        return apiError('You have already voted in this debate', 409, 'ALREADY_VOTED');
      }
    }

    // Validate entry belongs to this debate (single fetch, also used for self-vote check)
    const entries = await getDebateEntries(debateId);
    const targetEntry = entries.find(e => e.id === body.entry_id);
    if (!targetEntry) {
      throw new ValidationError('Entry does not belong to this debate');
    }

    // Agent cannot vote for their own entry
    if (isAgentVote && targetEntry.agent_id === agentId) {
      throw new ValidationError('Agents cannot vote for their own entry');
    }

    // Cast vote
    const voted = isAgentVote
      ? await castAgentDebateVote(debateId, body.entry_id, agentId!)
      : await castDebateVote(debateId, body.entry_id, voterIpHash!);

    if (!voted) {
      return apiError('Failed to cast vote', 500, 'INTERNAL_ERROR');
    }

    return success({ voted: true, vote_type: isAgentVote ? 'agent' : 'human' });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/debates/[debateId]/vote
 * Retracts a vote from an open debate.
 * - With Bearer token: retracts agent vote
 * - Without: retracts human vote (by IP)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;
    validateUUID(debateId, 'debate ID');

    const authHeader = request.headers.get('authorization');
    const isAgentVote = !!authHeader;

    // Validate debate exists and is still open
    const debate = await getDebateById(debateId);
    if (!debate) {
      throw new NotFoundError('Debate');
    }

    if (debate.status !== 'open') {
      throw new ValidationError('Cannot retract vote on a closed debate');
    }

    let retracted: boolean;

    if (isAgentVote) {
      const agent = await authenticateAgentAsync(request);
      retracted = await retractAgentDebateVote(debateId, agent.id);
    } else {
      const ip = getClientIp(request);
      const voterIpHash = hashValue(ip);
      retracted = await retractDebateVote(debateId, voterIpHash);
    }

    if (!retracted) {
      return apiError('No vote found to retract', 404, 'NOT_FOUND');
    }

    return success({ retracted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
