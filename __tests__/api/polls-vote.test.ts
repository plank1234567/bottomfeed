/**
 * Polls Vote API Integration Tests
 * Tests for POST /api/polls/[pollId]/vote and GET /api/polls/[pollId]/vote
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/polls/[pollId]/vote/route';
import { createPoll } from '@/lib/db/polls';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './integration/helpers';

describe('Polls Vote API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('POST /api/polls/[pollId]/vote', () => {
    it('returns 501 Not Implemented for all vote attempts', async () => {
      const agent = createTestAgent('pollcreator', 'Poll Creator');
      if (!agent) throw new Error('Failed to create agent');

      const result = createPoll(agent.agent.id, 'What is best?', ['Option A', 'Option B']);
      if (!result) throw new Error('Failed to create poll');

      const request = createMockRequest(`/api/polls/${result.poll.id}/vote`, {
        method: 'POST',
        body: { option_id: result.poll.options[0]!.id, agent_id: agent.agent.id },
      });

      const response = await POST(request, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(501);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_IMPLEMENTED');
    });

    it('returns 501 even with valid auth and trust tier', async () => {
      const creator = createTestAgent('pollmaker2', 'Poll Maker 2');
      const voter = createTestAgent('hightrustvoter', 'High Trust Voter');
      if (!creator || !voter) throw new Error('Failed to create agents');

      const result = createPoll(creator.agent.id, 'Best language?', ['Python', 'Rust', 'Go']);
      if (!result) throw new Error('Failed to create poll');

      const request = createAuthenticatedRequest(
        `/api/polls/${result.poll.id}/vote`,
        voter.apiKey,
        {
          method: 'POST',
          body: { option_id: result.poll.options[0]!.id, agent_id: voter.agent.id },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(501);
    });
  });

  describe('GET /api/polls/[pollId]/vote', () => {
    it('returns poll results for an existing poll', async () => {
      const creator = createTestAgent('pollresultcreator', 'Poll Result Creator');
      if (!creator) throw new Error('Failed to create agent');

      const result = createPoll(creator.agent.id, 'Results test?', ['Option 1', 'Option 2']);
      if (!result) throw new Error('Failed to create poll');

      const request = createMockRequest(`/api/polls/${result.poll.id}/vote`);
      const response = await GET(request, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('poll_id');
      expect(data.data).toHaveProperty('question');
      expect(data.data).toHaveProperty('options');
      expect(data.data).toHaveProperty('total_votes');
      expect(data.data.total_votes).toBe(0);
    });

    it('returns 404 for non-existent poll', async () => {
      const request = createMockRequest('/api/polls/30000000-0000-4000-8000-000000000099/vote');
      const response = await GET(request, {
        params: Promise.resolve({ pollId: '30000000-0000-4000-8000-000000000099' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });
});
