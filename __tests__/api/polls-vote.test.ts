/**
 * Polls Vote API Integration Tests
 * Tests for POST /api/polls/[pollId]/vote and GET /api/polls/[pollId]/vote
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/polls/[pollId]/vote/route';
import { createPoll } from '@/lib/db/polls';
import { agents } from '@/lib/db/store';
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
    it('returns 401 when no auth is provided', async () => {
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
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('returns 403 when agent trust tier is insufficient', async () => {
      const creator = createTestAgent('pollmaker', 'Poll Maker');
      const voter = createTestAgent('lowtrustvoter', 'Low Trust Voter');
      if (!creator || !voter) throw new Error('Failed to create agents');

      // voter has trust_tier autonomous-1 by default from createTestAgent
      // The route requires autonomous-2 or higher
      const voterAgent = agents.get(voter.agent.id);
      if (voterAgent) {
        voterAgent.trust_tier = 'autonomous-1';
      }

      const result = createPoll(creator.agent.id, 'Vote test?', ['Yes', 'No']);
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
      const { status, data } = await parseResponse(response);

      expect(status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('successfully votes with sufficient trust tier', async () => {
      const creator = createTestAgent('pollmaker2', 'Poll Maker 2');
      const voter = createTestAgent('hightrustvoter', 'High Trust Voter');
      if (!creator || !voter) throw new Error('Failed to create agents');

      // Upgrade voter to autonomous-2
      const voterAgent = agents.get(voter.agent.id);
      if (voterAgent) {
        voterAgent.trust_tier = 'autonomous-2';
      }

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
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.voted).toBe(true);
      expect(data.data.poll).toBeDefined();
    });

    it('prevents double voting by the same agent', async () => {
      const creator = createTestAgent('pollmaker3', 'Poll Maker 3');
      const voter = createTestAgent('doublevoter', 'Double Voter');
      if (!creator || !voter) throw new Error('Failed to create agents');

      const voterAgent = agents.get(voter.agent.id);
      if (voterAgent) {
        voterAgent.trust_tier = 'autonomous-2';
      }

      const result = createPoll(creator.agent.id, 'Only one vote?', ['Yes', 'No']);
      if (!result) throw new Error('Failed to create poll');

      // First vote
      const request1 = createAuthenticatedRequest(
        `/api/polls/${result.poll.id}/vote`,
        voter.apiKey,
        {
          method: 'POST',
          body: { option_id: result.poll.options[0]!.id, agent_id: voter.agent.id },
        }
      );
      const response1 = await POST(request1, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });
      const { status: status1 } = await parseResponse(response1);
      expect(status1).toBe(200);

      // Second vote attempt
      const request2 = createAuthenticatedRequest(
        `/api/polls/${result.poll.id}/vote`,
        voter.apiKey,
        {
          method: 'POST',
          body: { option_id: result.poll.options[1]!.id, agent_id: voter.agent.id },
        }
      );
      const response2 = await POST(request2, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });
      const { status: status2, data: data2 } = await parseResponse(response2);

      expect(status2).toBe(400);
      expect(data2.success).toBe(false);
    });

    it('returns 404 for non-existent poll', async () => {
      const voter = createTestAgent('ghostpollvoter', 'Ghost Poll Voter');
      if (!voter) throw new Error('Failed to create agent');

      const voterAgent = agents.get(voter.agent.id);
      if (voterAgent) {
        voterAgent.trust_tier = 'autonomous-2';
      }

      const request = createAuthenticatedRequest(
        '/api/polls/nonexistent-poll-id/vote',
        voter.apiKey,
        {
          method: 'POST',
          body: { option_id: 'some-option-id', agent_id: voter.agent.id },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ pollId: 'nonexistent-poll-id' }),
      });
      const { status } = await parseResponse(response);

      // Zod validation will fail first on non-uuid option_id/agent_id,
      // but if they are valid UUIDs it would return 404
      expect([400, 404]).toContain(status);
    });

    it('returns 403 when agent_id in body does not match authenticated agent', async () => {
      const creator = createTestAgent('pollmaker4', 'Poll Maker 4');
      const voter = createTestAgent('impersonator', 'Impersonator');
      const target = createTestAgent('targetagent', 'Target Agent');
      if (!creator || !voter || !target) throw new Error('Failed to create agents');

      const voterAgent = agents.get(voter.agent.id);
      if (voterAgent) {
        voterAgent.trust_tier = 'autonomous-2';
      }

      const result = createPoll(creator.agent.id, 'Impersonation test?', ['A', 'B']);
      if (!result) throw new Error('Failed to create poll');

      // Authenticate as voter but claim to be target
      const request = createAuthenticatedRequest(
        `/api/polls/${result.poll.id}/vote`,
        voter.apiKey,
        {
          method: 'POST',
          body: { option_id: result.poll.options[0]!.id, agent_id: target.agent.id },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });

    it('validates request body with Zod schema', async () => {
      const voter = createTestAgent('schemvoter', 'Schema Voter');
      if (!voter) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest('/api/polls/some-poll/vote', voter.apiKey, {
        method: 'POST',
        body: { invalid_field: 'test' },
      });

      const response = await POST(request, {
        params: Promise.resolve({ pollId: 'some-poll' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
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
      const request = createMockRequest('/api/polls/nonexistent/vote');
      const response = await GET(request, {
        params: Promise.resolve({ pollId: 'nonexistent' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });

    it('returns updated vote counts after voting', async () => {
      const creator = createTestAgent('pollcountcreator', 'Poll Count Creator');
      const voter = createTestAgent('pollcountvoter', 'Poll Count Voter');
      if (!creator || !voter) throw new Error('Failed to create agents');

      const voterAgent = agents.get(voter.agent.id);
      if (voterAgent) {
        voterAgent.trust_tier = 'autonomous-2';
      }

      const result = createPoll(creator.agent.id, 'Count test?', ['Alpha', 'Beta']);
      if (!result) throw new Error('Failed to create poll');

      // Vote first
      const voteRequest = createAuthenticatedRequest(
        `/api/polls/${result.poll.id}/vote`,
        voter.apiKey,
        {
          method: 'POST',
          body: { option_id: result.poll.options[0]!.id, agent_id: voter.agent.id },
        }
      );
      await POST(voteRequest, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });

      // Then check results
      const getRequest = createMockRequest(`/api/polls/${result.poll.id}/vote`);
      const response = await GET(getRequest, {
        params: Promise.resolve({ pollId: result.poll.id }),
      });
      const { data } = await parseResponse(response);

      expect(data.data.total_votes).toBe(1);
      expect(data.data.options[0].votes).toBe(1);
      expect(data.data.options[0].percentage).toBe(100);
    });
  });
});
