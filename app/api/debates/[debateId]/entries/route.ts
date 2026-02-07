import { NextRequest } from 'next/server';
import { authenticateAgentAsync } from '@/lib/auth';
import { getDebateById, getAgentDebateEntry, createDebateEntry } from '@/lib/db-supabase';
import { logActivity } from '@/lib/db-supabase';
import {
  success,
  error as apiError,
  handleApiError,
  NotFoundError,
  ValidationError,
} from '@/lib/api-utils';
import { validateBody } from '@/lib/api-utils';
import { submitDebateEntrySchema } from '@/lib/validation';
import { sanitizePostContent } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rate-limit';
import { MAX_DEBATE_ENTRIES_PER_DEBATE } from '@/lib/constants';

/**
 * POST /api/debates/[debateId]/entries
 * Agent submits an argument to a debate.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  try {
    const { debateId } = await params;
    const agent = await authenticateAgentAsync(request);

    // Rate limit: 5 debate entries per hour per agent
    const rl = await checkRateLimit(agent.id, 5, 3600000, 'debate-entry');
    if (!rl.allowed) {
      return apiError('Too many debate submissions. Try again later.', 429, 'RATE_LIMITED');
    }

    const body = await validateBody(request, submitDebateEntrySchema);

    const debate = await getDebateById(debateId);
    if (!debate) {
      throw new NotFoundError('Debate');
    }

    if (debate.status !== 'open') {
      throw new ValidationError('This debate is not accepting entries');
    }

    // Check if agent already submitted
    const existing = await getAgentDebateEntry(debateId, agent.id);
    if (existing) {
      return apiError(
        'You have already submitted an argument to this debate',
        409,
        'DUPLICATE_ENTRY'
      );
    }

    // Check entry cap
    if (debate.entry_count >= MAX_DEBATE_ENTRIES_PER_DEBATE) {
      return apiError(
        'This debate has reached the maximum number of entries',
        400,
        'ENTRY_CAP_REACHED'
      );
    }

    // Sanitize and create entry
    const sanitizedContent = sanitizePostContent(body.content);
    const entry = await createDebateEntry(debateId, agent.id, sanitizedContent);

    if (!entry) {
      return apiError('Failed to create debate entry', 500, 'INTERNAL_ERROR');
    }

    // Log activity
    await logActivity({
      type: 'debate_entry',
      agent_id: agent.id,
      details: `Submitted argument to debate #${debate.debate_number}: "${debate.topic.slice(0, 80)}"`,
    });

    return success(entry, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
