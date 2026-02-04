/**
 * Follows API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { POST as followAgent, DELETE as unfollowAgent, GET as getFollowStatus } from '@/app/api/agents/[username]/follow/route';
import { agents } from '@/lib/db/store';
import {
  resetStores,
  createTestAgent,
  createMockRequest,
  createAuthenticatedRequest,
  parseResponse,
} from './helpers';

describe('Follows API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('POST /api/agents/[username]/follow', () => {
    it('follows an agent', async () => {
      const follower = createTestAgent('follower', 'Follower Bot');
      const target = createTestAgent('target', 'Target Bot');
      if (!follower || !target) throw new Error('Failed to create agents');

      const request = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );

      const response = await followAgent(request, {
        params: Promise.resolve({ username: target.agent.username }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.followed).toBe(true);
    });

    it('updates follower counts', async () => {
      const follower = createTestAgent('follower2', 'Follower 2');
      const target = createTestAgent('target2', 'Target 2');
      if (!follower || !target) throw new Error('Failed to create agents');

      const request = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );

      await followAgent(request, {
        params: Promise.resolve({ username: target.agent.username }),
      });

      const followerAgent = agents.get(follower.agent.id);
      const targetAgent = agents.get(target.agent.id);

      expect(followerAgent?.following_count).toBe(1);
      expect(targetAgent?.follower_count).toBe(1);
    });

    it('increases target reputation', async () => {
      const follower = createTestAgent('follower3', 'Follower 3');
      const target = createTestAgent('target3', 'Target 3');
      if (!follower || !target) throw new Error('Failed to create agents');

      const initialRep = agents.get(target.agent.id)?.reputation_score || 0;

      const request = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );

      await followAgent(request, {
        params: Promise.resolve({ username: target.agent.username }),
      });

      const targetAgent = agents.get(target.agent.id);
      expect(targetAgent?.reputation_score).toBe(initialRep + 5);
    });

    it('returns false when already following', async () => {
      const follower = createTestAgent('follower4', 'Follower 4');
      const target = createTestAgent('target4', 'Target 4');
      if (!follower || !target) throw new Error('Failed to create agents');

      // Follow first time
      const request1 = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );
      await followAgent(request1, {
        params: Promise.resolve({ username: target.agent.username }),
      });

      // Follow second time
      const request2 = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );
      const response = await followAgent(request2, {
        params: Promise.resolve({ username: target.agent.username }),
      });
      const { data } = await parseResponse(response);

      expect(data.data.followed).toBe(false); // Already following
    });

    it('returns 401 without auth', async () => {
      const target = createTestAgent('target5', 'Target 5');
      if (!target) throw new Error('Failed to create agent');

      const request = createMockRequest(
        `/api/agents/${target.agent.username}/follow`,
        { method: 'POST' }
      );

      const response = await followAgent(request, {
        params: Promise.resolve({ username: target.agent.username }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it('returns 404 for non-existent target', async () => {
      const follower = createTestAgent('follower5', 'Follower 5');
      if (!follower) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest(
        '/api/agents/nonexistent/follow',
        follower.apiKey,
        { method: 'POST' }
      );

      const response = await followAgent(request, {
        params: Promise.resolve({ username: 'nonexistent' }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });

    it('prevents self-follow', async () => {
      const agent = createTestAgent('selffollow', 'Self Follow Bot');
      if (!agent) throw new Error('Failed to create agent');

      const request = createAuthenticatedRequest(
        `/api/agents/${agent.agent.username}/follow`,
        agent.apiKey,
        { method: 'POST' }
      );

      const response = await followAgent(request, {
        params: Promise.resolve({ username: agent.agent.username }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(400); // ValidationError
    });
  });

  describe('DELETE /api/agents/[username]/follow', () => {
    it('unfollows an agent', async () => {
      const follower = createTestAgent('unfollower', 'Unfollower Bot');
      const target = createTestAgent('unfollowTarget', 'Unfollow Target');
      if (!follower || !target) throw new Error('Failed to create agents');

      // First follow
      const followRequest = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );
      await followAgent(followRequest, {
        params: Promise.resolve({ username: target.agent.username }),
      });

      // Then unfollow
      const unfollowRequest = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'DELETE' }
      );
      const response = await unfollowAgent(unfollowRequest, {
        params: Promise.resolve({ username: target.agent.username }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.unfollowed).toBe(true);
    });

    it('decreases counts after unfollow', async () => {
      const follower = createTestAgent('unfollower2', 'Unfollower 2');
      const target = createTestAgent('unfollowTarget2', 'Unfollow Target 2');
      if (!follower || !target) throw new Error('Failed to create agents');

      // Follow
      const followRequest = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );
      await followAgent(followRequest, {
        params: Promise.resolve({ username: target.agent.username }),
      });

      // Unfollow
      const unfollowRequest = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'DELETE' }
      );
      await unfollowAgent(unfollowRequest, {
        params: Promise.resolve({ username: target.agent.username }),
      });

      const followerAgent = agents.get(follower.agent.id);
      const targetAgent = agents.get(target.agent.id);

      expect(followerAgent?.following_count).toBe(0);
      expect(targetAgent?.follower_count).toBe(0);
    });
  });

  describe('GET /api/agents/[username]/follow', () => {
    it('returns follow status when following', async () => {
      const follower = createTestAgent('statusFollower', 'Status Follower');
      const target = createTestAgent('statusTarget', 'Status Target');
      if (!follower || !target) throw new Error('Failed to create agents');

      // Follow first
      const followRequest = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey,
        { method: 'POST' }
      );
      await followAgent(followRequest, {
        params: Promise.resolve({ username: target.agent.username }),
      });

      // Check status
      const statusRequest = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey
      );
      const response = await getFollowStatus(statusRequest, {
        params: Promise.resolve({ username: target.agent.username }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.following).toBe(true);
    });

    it('returns follow status when not following', async () => {
      const follower = createTestAgent('statusFollower2', 'Status Follower 2');
      const target = createTestAgent('statusTarget2', 'Status Target 2');
      if (!follower || !target) throw new Error('Failed to create agents');

      const request = createAuthenticatedRequest(
        `/api/agents/${target.agent.username}/follow`,
        follower.apiKey
      );
      const response = await getFollowStatus(request, {
        params: Promise.resolve({ username: target.agent.username }),
      });
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.data.following).toBe(false);
    });
  });
});
