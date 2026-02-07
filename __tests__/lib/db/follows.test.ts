/**
 * Tests for follow/unfollow operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  agentFollow,
  agentUnfollow,
  isAgentFollowing,
  getAgentFollowers,
  getAgentFollowing,
} from '@/lib/db/follows';
import { createAgent } from '@/lib/db/agents';
import {
  agents,
  apiKeys,
  follows,
  agentsByUsername,
  agentsByTwitter,
  followers,
} from '@/lib/db/store';

describe('Follow Operations', () => {
  let testAgent1: { agent: { id: string }; apiKey: string };
  let testAgent2: { agent: { id: string }; apiKey: string };
  let testAgent3: { agent: { id: string }; apiKey: string };

  beforeEach(() => {
    // Clear all stores and indexes
    agents.clear();
    apiKeys.clear();
    follows.clear();
    agentsByUsername.clear();
    agentsByTwitter.clear();
    followers.clear();

    // Create test agents
    testAgent1 = createAgent('testbot1', 'Test Bot 1', 'gpt-4', 'openai')!;
    testAgent2 = createAgent('testbot2', 'Test Bot 2', 'claude-3', 'anthropic')!;
    testAgent3 = createAgent('testbot3', 'Test Bot 3', 'llama', 'meta')!;
  });

  describe('agentFollow', () => {
    it('follows another agent successfully', () => {
      const result = agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      expect(result).toBe(true);
    });

    it('returns false when already following', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      const result = agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      expect(result).toBe(false);
    });

    it('returns false when trying to follow self', () => {
      const result = agentFollow(testAgent1.agent.id, testAgent1.agent.id);
      expect(result).toBe(false);
    });

    it('increments follower following_count', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);

      const follower = agents.get(testAgent1.agent.id);
      expect(follower!.following_count).toBe(1);
    });

    it('increments followed follower_count', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);

      const followed = agents.get(testAgent2.agent.id);
      expect(followed!.follower_count).toBe(1);
    });

    it('increases followed reputation by 5', () => {
      const initialReputation = agents.get(testAgent2.agent.id)!.reputation_score;

      agentFollow(testAgent1.agent.id, testAgent2.agent.id);

      const followed = agents.get(testAgent2.agent.id);
      expect(followed!.reputation_score).toBe(initialReputation + 5);
    });
  });

  describe('agentUnfollow', () => {
    it('unfollows successfully', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      const result = agentUnfollow(testAgent1.agent.id, testAgent2.agent.id);
      expect(result).toBe(true);
    });

    it('returns false when not following', () => {
      const result = agentUnfollow(testAgent1.agent.id, testAgent2.agent.id);
      expect(result).toBe(false);
    });

    it('decrements follower following_count', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      agentUnfollow(testAgent1.agent.id, testAgent2.agent.id);

      const follower = agents.get(testAgent1.agent.id);
      expect(follower!.following_count).toBe(0);
    });

    it('decrements followed follower_count', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      agentUnfollow(testAgent1.agent.id, testAgent2.agent.id);

      const followed = agents.get(testAgent2.agent.id);
      expect(followed!.follower_count).toBe(0);
    });

    it('decreases followed reputation by 5', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      const afterFollow = agents.get(testAgent2.agent.id)!.reputation_score;

      agentUnfollow(testAgent1.agent.id, testAgent2.agent.id);

      const followed = agents.get(testAgent2.agent.id);
      expect(followed!.reputation_score).toBe(afterFollow - 5);
    });

    it('does not go below zero for counts', () => {
      agentUnfollow(testAgent1.agent.id, testAgent2.agent.id);

      const follower = agents.get(testAgent1.agent.id);
      const followed = agents.get(testAgent2.agent.id);
      expect(follower!.following_count).toBe(0);
      expect(followed!.follower_count).toBe(0);
    });

    it('does not go below zero for reputation', () => {
      const agent = agents.get(testAgent2.agent.id);
      agent!.reputation_score = 2; // Set to 2, follow adds 5 = 7, unfollow subtracts 5 = 2

      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      expect(agent!.reputation_score).toBe(7); // 2 + 5

      agentUnfollow(testAgent1.agent.id, testAgent2.agent.id);
      expect(agent!.reputation_score).toBe(2); // 7 - 5

      // Test the actual boundary: set to 3, unfollow should go to max(0, 3-5) = 0
      agent!.reputation_score = 3;
      agentFollow(testAgent1.agent.id, testAgent2.agent.id); // 3 + 5 = 8
      agent!.reputation_score = 3; // Force it back to 3
      agentUnfollow(testAgent1.agent.id, testAgent2.agent.id); // max(0, 3-5) = 0
      expect(agent!.reputation_score).toBe(0);
    });
  });

  describe('isAgentFollowing', () => {
    it('returns true when following', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      expect(isAgentFollowing(testAgent1.agent.id, testAgent2.agent.id)).toBe(true);
    });

    it('returns false when not following', () => {
      expect(isAgentFollowing(testAgent1.agent.id, testAgent2.agent.id)).toBe(false);
    });

    it('returns false for agent with no follows', () => {
      expect(isAgentFollowing('nonexistent', testAgent2.agent.id)).toBe(false);
    });
  });

  describe('getAgentFollowers', () => {
    it('returns all followers', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      agentFollow(testAgent3.agent.id, testAgent2.agent.id);

      const followers = getAgentFollowers(testAgent2.agent.id);
      expect(followers.length).toBe(2);
      expect(followers.map(a => a.id)).toContain(testAgent1.agent.id);
      expect(followers.map(a => a.id)).toContain(testAgent3.agent.id);
    });

    it('returns empty array when no followers', () => {
      const followers = getAgentFollowers(testAgent1.agent.id);
      expect(followers).toEqual([]);
    });
  });

  describe('getAgentFollowing', () => {
    it('returns all agents being followed', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      agentFollow(testAgent1.agent.id, testAgent3.agent.id);

      const following = getAgentFollowing(testAgent1.agent.id);
      expect(following.length).toBe(2);
      expect(following.map(a => a.id)).toContain(testAgent2.agent.id);
      expect(following.map(a => a.id)).toContain(testAgent3.agent.id);
    });

    it('returns empty array when not following anyone', () => {
      const following = getAgentFollowing(testAgent1.agent.id);
      expect(following).toEqual([]);
    });
  });

  describe('complex follow scenarios', () => {
    it('handles mutual follows', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      agentFollow(testAgent2.agent.id, testAgent1.agent.id);

      expect(isAgentFollowing(testAgent1.agent.id, testAgent2.agent.id)).toBe(true);
      expect(isAgentFollowing(testAgent2.agent.id, testAgent1.agent.id)).toBe(true);

      const agent1 = agents.get(testAgent1.agent.id);
      const agent2 = agents.get(testAgent2.agent.id);

      expect(agent1!.following_count).toBe(1);
      expect(agent1!.follower_count).toBe(1);
      expect(agent2!.following_count).toBe(1);
      expect(agent2!.follower_count).toBe(1);
    });

    it('handles following chain', () => {
      agentFollow(testAgent1.agent.id, testAgent2.agent.id);
      agentFollow(testAgent2.agent.id, testAgent3.agent.id);
      agentFollow(testAgent3.agent.id, testAgent1.agent.id);

      expect(getAgentFollowing(testAgent1.agent.id).length).toBe(1);
      expect(getAgentFollowing(testAgent2.agent.id).length).toBe(1);
      expect(getAgentFollowing(testAgent3.agent.id).length).toBe(1);
    });
  });
});
