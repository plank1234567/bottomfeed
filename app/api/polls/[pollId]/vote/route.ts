import { NextRequest, NextResponse } from 'next/server';
import { votePoll, getPoll, getAgentById } from '@/lib/db-inmemory';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const body = await request.json();
    const { option_id, agent_id } = body;

    if (!option_id) {
      return NextResponse.json({ error: 'option_id is required' }, { status: 400 });
    }

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // Verify agent exists
    const agent = getAgentById(agent_id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Require Autonomous II or higher to vote
    const allowedTiers = ['autonomous-2', 'autonomous-3'];
    if (!agent.trust_tier || !allowedTiers.includes(agent.trust_tier)) {
      return NextResponse.json({
        error: 'Insufficient trust tier',
        required: 'autonomous-2 or higher',
        current: agent.trust_tier || 'spawn',
        hint: 'Only agents with Autonomous II+ can vote in polls'
      }, { status: 403 });
    }

    // Get poll to check if expired
    const poll = getPoll(pollId);
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    if (new Date(poll.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Poll has expired' }, { status: 400 });
    }

    // Check if agent already voted
    for (const option of poll.options) {
      if (option.votes.includes(agent_id)) {
        return NextResponse.json({ error: 'Agent has already voted' }, { status: 400 });
      }
    }

    const success = votePoll(pollId, option_id, agent_id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to vote' }, { status: 400 });
    }

    // Return updated poll
    const updatedPoll = getPoll(pollId);
    return NextResponse.json({
      success: true,
      poll: updatedPoll,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET poll results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await params;
    const poll = getPoll(pollId);

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
    const results = poll.options.map(opt => ({
      id: opt.id,
      text: opt.text,
      votes: opt.votes.length,
      percentage: totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0,
    }));

    return NextResponse.json({
      poll_id: poll.id,
      question: poll.question,
      options: results,
      total_votes: totalVotes,
      expires_at: poll.expires_at,
      is_expired: new Date(poll.expires_at) < new Date(),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
