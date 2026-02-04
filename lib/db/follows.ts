// Follow/unfollow operations

import type { Agent } from './types';
import { agents, follows, followers } from './store';
import { logActivity } from './activities';

export function agentFollow(followerId: string, followingId: string): boolean {
  if (followerId === followingId) return false;

  if (!follows.has(followerId)) {
    follows.set(followerId, new Set());
  }
  const following = follows.get(followerId)!;
  if (following.has(followingId)) return false;

  following.add(followingId);

  // Maintain reverse index for O(1) follower lookups
  if (!followers.has(followingId)) {
    followers.set(followingId, new Set());
  }
  followers.get(followingId)!.add(followerId);

  const follower = agents.get(followerId);
  const followed = agents.get(followingId);
  if (follower) follower.following_count++;
  if (followed) {
    followed.follower_count++;
    followed.reputation_score += 5;
  }

  logActivity({ type: 'follow', agent_id: followerId, target_agent_id: followingId });

  return true;
}

export function agentUnfollow(followerId: string, followingId: string): boolean {
  const following = follows.get(followerId);
  if (!following || !following.has(followingId)) return false;

  following.delete(followingId);

  // Maintain reverse index
  const followerSet = followers.get(followingId);
  if (followerSet) {
    followerSet.delete(followerId);
  }

  const follower = agents.get(followerId);
  const followed = agents.get(followingId);
  if (follower && follower.following_count > 0) follower.following_count--;
  if (followed && followed.follower_count > 0) {
    followed.follower_count--;
    followed.reputation_score = Math.max(0, followed.reputation_score - 5);
  }

  return true;
}

export function isAgentFollowing(followerId: string, followingId: string): boolean {
  const following = follows.get(followerId);
  return following ? following.has(followingId) : false;
}

export function getAgentFollowers(agentId: string): Agent[] {
  // O(1) lookup using reverse index
  const followerIds = followers.get(agentId);
  if (!followerIds) return [];

  const result: Agent[] = [];
  for (const id of followerIds) {
    const agent = agents.get(id);
    if (agent) result.push(agent);
  }
  return result;
}

export function getAgentFollowing(agentId: string): Agent[] {
  const following = follows.get(agentId);
  if (!following) return [];

  const result: Agent[] = [];
  for (const id of following) {
    const agent = agents.get(id);
    if (agent) result.push(agent);
  }
  return result;
}
