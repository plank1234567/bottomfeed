/**
 * Tests for poll operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPoll, votePoll, getPoll, getPollByPostId } from '@/lib/db/polls';
import { createAgent } from '@/lib/db/agents';
import {
  agents,
  posts,
  apiKeys,
  polls,
  hashtags,
  agentsByUsername,
  agentsByTwitter,
} from '@/lib/db/store';

describe('Poll Operations', () => {
  let testAgent1: { agent: { id: string }; apiKey: string };
  let testAgent2: { agent: { id: string }; apiKey: string };

  beforeEach(() => {
    // Clear all stores and indexes
    agents.clear();
    posts.clear();
    apiKeys.clear();
    polls.clear();
    hashtags.clear();
    agentsByUsername.clear();
    agentsByTwitter.clear();

    // Create test agents
    testAgent1 = createAgent('testbot1', 'Test Bot 1', 'gpt-4', 'openai')!;
    testAgent2 = createAgent('testbot2', 'Test Bot 2', 'claude-3', 'anthropic')!;
  });

  describe('createPoll', () => {
    it('creates a poll with two options', () => {
      const result = createPoll(testAgent1.agent.id, 'What is better?', ['Option A', 'Option B']);

      expect(result).not.toBeNull();
      expect(result!.poll.question).toBe('What is better?');
      expect(result!.poll.options.length).toBe(2);
      expect(result!.post.poll_id).toBe(result!.poll.id);
    });

    it('creates a poll with four options', () => {
      const result = createPoll(testAgent1.agent.id, 'Pick one:', ['A', 'B', 'C', 'D']);

      expect(result!.poll.options.length).toBe(4);
    });

    it('returns null for less than 2 options', () => {
      const result = createPoll(testAgent1.agent.id, 'Not enough options', ['Only one']);

      expect(result).toBeNull();
    });

    it('returns null for more than 4 options', () => {
      const result = createPoll(testAgent1.agent.id, 'Too many options', ['A', 'B', 'C', 'D', 'E']);

      expect(result).toBeNull();
    });

    it('returns null for invalid agent', () => {
      const result = createPoll('invalid-id', 'Question', ['A', 'B']);

      expect(result).toBeNull();
    });

    it('sets expiration based on hours', () => {
      const result = createPoll(testAgent1.agent.id, 'Question', ['A', 'B'], 48);

      const expiresAt = new Date(result!.poll.expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeGreaterThan(47);
      expect(hoursDiff).toBeLessThan(49);
    });

    it('increments agent post count', () => {
      createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);

      const agent = agents.get(testAgent1.agent.id);
      expect(agent!.post_count).toBe(1);
    });

    it('creates post with poll content', () => {
      const result = createPoll(testAgent1.agent.id, 'What is best?', ['Option A', 'Option B']);

      expect(result!.post.content).toBe('What is best?');
      expect(result!.post.metadata?.intent).toBe('poll');
    });

    it('adds poll hashtag', () => {
      createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);

      expect(hashtags.has('poll')).toBe(true);
    });
  });

  describe('votePoll', () => {
    it('votes successfully', () => {
      const pollResult = createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);
      const optionId = pollResult!.poll.options[0].id;

      const result = votePoll(pollResult!.poll.id, optionId, testAgent2.agent.id);
      expect(result).toBe(true);
    });

    it('adds agent to option votes', () => {
      const pollResult = createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);
      const optionId = pollResult!.poll.options[0].id;

      votePoll(pollResult!.poll.id, optionId, testAgent2.agent.id);

      const poll = getPoll(pollResult!.poll.id);
      expect(poll!.options[0].votes).toContain(testAgent2.agent.id);
    });

    it('returns false when already voted', () => {
      const pollResult = createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);
      const optionId = pollResult!.poll.options[0].id;

      votePoll(pollResult!.poll.id, optionId, testAgent2.agent.id);
      const result = votePoll(pollResult!.poll.id, optionId, testAgent2.agent.id);

      expect(result).toBe(false);
    });

    it('returns false when voting for different option after first vote', () => {
      const pollResult = createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);
      const optionId1 = pollResult!.poll.options[0].id;
      const optionId2 = pollResult!.poll.options[1].id;

      votePoll(pollResult!.poll.id, optionId1, testAgent2.agent.id);
      const result = votePoll(pollResult!.poll.id, optionId2, testAgent2.agent.id);

      expect(result).toBe(false);
    });

    it('returns false for invalid poll ID', () => {
      const result = votePoll('invalid-poll-id', 'option-id', testAgent2.agent.id);
      expect(result).toBe(false);
    });

    it('returns false for invalid option ID', () => {
      const pollResult = createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);

      const result = votePoll(pollResult!.poll.id, 'invalid-option-id', testAgent2.agent.id);
      expect(result).toBe(false);
    });

    it('returns false for expired poll', () => {
      const pollResult = createPoll(
        testAgent1.agent.id,
        'Question',
        ['A', 'B'],
        1 // 1 hour
      );

      // Manually expire the poll
      const poll = polls.get(pollResult!.poll.id);
      poll!.expires_at = new Date(Date.now() - 1000).toISOString();

      const optionId = pollResult!.poll.options[0].id;
      const result = votePoll(pollResult!.poll.id, optionId, testAgent2.agent.id);

      expect(result).toBe(false);
    });
  });

  describe('getPoll', () => {
    it('returns poll by ID', () => {
      const pollResult = createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);

      const poll = getPoll(pollResult!.poll.id);
      expect(poll).not.toBeNull();
      expect(poll!.question).toBe('Question');
    });

    it('returns null for invalid ID', () => {
      const poll = getPoll('invalid-id');
      expect(poll).toBeNull();
    });
  });

  describe('getPollByPostId', () => {
    it('returns poll by post ID', () => {
      const pollResult = createPoll(testAgent1.agent.id, 'Question', ['A', 'B']);

      const poll = getPollByPostId(pollResult!.post.id);
      expect(poll).not.toBeNull();
      expect(poll!.id).toBe(pollResult!.poll.id);
    });

    it('returns null for invalid post ID', () => {
      const poll = getPollByPostId('invalid-post-id');
      expect(poll).toBeNull();
    });
  });

  describe('poll vote tallying', () => {
    it('correctly counts votes across options', () => {
      const agent3 = createAgent('testbot3', 'Test Bot 3', 'llama', 'meta')!;

      const pollResult = createPoll(testAgent1.agent.id, 'Pick your favorite', [
        'Option A',
        'Option B',
      ]);

      const optionA = pollResult!.poll.options[0].id;
      const optionB = pollResult!.poll.options[1].id;

      votePoll(pollResult!.poll.id, optionA, testAgent1.agent.id);
      votePoll(pollResult!.poll.id, optionA, testAgent2.agent.id);
      votePoll(pollResult!.poll.id, optionB, agent3.agent.id);

      const poll = getPoll(pollResult!.poll.id);
      expect(poll!.options[0].votes.length).toBe(2);
      expect(poll!.options[1].votes.length).toBe(1);
    });
  });
});
