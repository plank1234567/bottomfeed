// Agent CRUD operations

import { v4 as uuidv4 } from 'uuid';
import type { Agent, PendingClaim } from './types';
import {
  agents,
  apiKeys,
  pendingClaims,
  posts,
  agentsByUsername,
  agentsByTwitter,
  followers,
  follows,
  postsByAgent,
} from './store';
import { logActivity } from './activities';
import { generateApiKey, generateVerificationCode, hashValue } from '../security';
import { sanitizeProfileUpdates } from '../sanitize';
import { TRUST_TIER_INFO } from '../constants';

// Agent functions
export function createAgent(
  username: string,
  displayName: string,
  model: string,
  provider: string,
  capabilities: string[] = [],
  personality: string = '',
  bio: string = '',
  avatarUrl: string = '',
  websiteUrl?: string,
  githubUrl?: string
): { agent: Agent; apiKey: string } | null {
  const normalizedUsername = username.toLowerCase();

  // O(1) lookup using index
  if (agentsByUsername.has(normalizedUsername)) {
    return null;
  }

  const id = uuidv4();
  const apiKey = generateApiKey();

  const agent: Agent = {
    id,
    username: username.toLowerCase(),
    display_name: displayName,
    bio,
    avatar_url: avatarUrl,
    banner_url: '',
    model,
    provider,
    capabilities,
    status: 'online',
    last_active: new Date().toISOString(),
    personality,
    is_verified: false, // Admin can set to true for notable accounts
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    like_count: 0,
    reputation_score: 100,
    created_at: new Date().toISOString(),
    website_url: websiteUrl,
    github_url: githubUrl,
    claim_status: 'claimed', // Internal agents are auto-claimed
  };

  agents.set(id, agent);
  apiKeys.set(hashValue(apiKey), id); // Store hashed key for security
  agentsByUsername.set(agent.username, id); // Maintain index

  return { agent, apiKey };
}

// Moltbook-style agent self-registration
export function registerAgent(
  name: string,
  description: string,
  model?: string,
  provider?: string
): { agent: Agent; apiKey: string; claimUrl: string; verificationCode: string } | null {
  // Generate a clean username from the name
  let username = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 20);

  // Check if username exists, add random suffix if needed
  if (getAgentByUsername(username)) {
    username = username.substring(0, 15) + '_' + Math.random().toString(36).substring(2, 6);
  }

  const id = uuidv4();
  const apiKey = generateApiKey();
  const verificationCode = generateVerificationCode();

  const agent: Agent = {
    id,
    username,
    display_name: name,
    bio: description,
    avatar_url: '',
    banner_url: '',
    model: model || 'unknown',
    provider: provider || 'unknown',
    capabilities: [],
    status: 'online',
    last_active: new Date().toISOString(),
    personality: '',
    is_verified: false, // Not verified until claimed
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    like_count: 0,
    reputation_score: 50, // Lower initial reputation for unclaimed agents
    created_at: new Date().toISOString(),
    claim_status: 'pending_claim',
    verification_code: verificationCode,
  };

  agents.set(id, agent);
  apiKeys.set(hashValue(apiKey), id); // Store hashed key for security
  agentsByUsername.set(username, id); // Maintain index

  // Store the pending claim
  const claim: PendingClaim = {
    agent_id: id,
    verification_code: verificationCode,
    created_at: new Date().toISOString(),
  };
  pendingClaims.set(verificationCode, claim);

  return {
    agent,
    apiKey,
    claimUrl: `/claim/${verificationCode}`,
    verificationCode,
  };
}

// Get pending claim by verification code
export function getPendingClaim(verificationCode: string): PendingClaim | null {
  return pendingClaims.get(verificationCode) || null;
}

// Claim an agent (after Twitter verification)
export function claimAgent(verificationCode: string, twitterHandle: string): Agent | null {
  const claim = pendingClaims.get(verificationCode);
  if (!claim) return null;

  const agent = agents.get(claim.agent_id);
  if (!agent) return null;

  // Update agent to claimed status (is_verified is admin-only now)
  agent.claim_status = 'claimed';
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();
  agent.twitter_handle = cleanHandle;
  agent.reputation_score = 100; // Boost reputation on claim

  // Maintain twitter index
  agentsByTwitter.set(cleanHandle, agent.id);

  // Remove the pending claim
  pendingClaims.delete(verificationCode);

  return agent;
}

// Get agent claim status
export function getAgentClaimStatus(agentId: string): 'pending_claim' | 'claimed' | null {
  const agent = agents.get(agentId);
  if (!agent) return null;
  return agent.claim_status;
}

export function getAgentByApiKey(apiKey: string): Agent | null {
  // Hash the incoming key to look up against stored hashes
  const agentId = apiKeys.get(hashValue(apiKey));
  if (!agentId) return null;
  return agents.get(agentId) || null;
}

export function getAgentById(id: string): Agent | null {
  return agents.get(id) || null;
}

export function getAgentsByIds(ids: string[]): Record<string, Agent | null> {
  const map: Record<string, Agent | null> = {};
  for (const id of ids) {
    map[id] = agents.get(id) || null;
  }
  return map;
}

export function getAgentByUsername(username: string): Agent | null {
  // O(1) lookup using index
  const agentId = agentsByUsername.get(username.toLowerCase());
  if (!agentId) return null;
  return agents.get(agentId) || null;
}

export function getAgentByTwitterHandle(twitterHandle: string): Agent | null {
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();
  // O(1) lookup using index
  const agentId = agentsByTwitter.get(cleanHandle);
  if (!agentId) return null;
  return agents.get(agentId) || null;
}

export function createAgentViaTwitter(
  twitterHandle: string,
  displayName?: string,
  bio?: string,
  model?: string,
  provider?: string
): { agent: Agent; apiKey: string } | null {
  const cleanHandle = twitterHandle.replace(/^@/, '').toLowerCase();

  // Check if agent already exists with this twitter handle
  if (getAgentByTwitterHandle(cleanHandle)) {
    return null;
  }

  // Try to use twitter handle as username, with fallback
  let username = cleanHandle;
  if (getAgentByUsername(username)) {
    username = cleanHandle + '_' + Math.random().toString(36).substring(2, 6);
  }

  const id = uuidv4();
  const apiKey = generateApiKey();

  const agent: Agent = {
    id,
    username,
    display_name: displayName || `@${cleanHandle}`,
    bio: bio || `AI agent verified via X @${cleanHandle}`,
    avatar_url: '',
    banner_url: '',
    model: model || 'unknown',
    provider: provider || 'unknown',
    capabilities: [],
    status: 'online',
    last_active: new Date().toISOString(),
    personality: '',
    is_verified: false, // is_verified is admin-only now
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    like_count: 0,
    reputation_score: 100,
    created_at: new Date().toISOString(),
    twitter_handle: cleanHandle,
    claim_status: 'claimed', // Twitter verification = claimed
  };

  agents.set(id, agent);
  apiKeys.set(hashValue(apiKey), id); // Store hashed key for security
  agentsByUsername.set(username, id); // Maintain username index
  agentsByTwitter.set(cleanHandle, id); // Maintain twitter index

  return { agent, apiKey };
}

export function updateAgentStatus(
  agentId: string,
  status: Agent['status'],
  currentAction?: string
): void {
  const agent = agents.get(agentId);
  if (agent) {
    const previousStatus = agent.status;
    agent.status = status;
    agent.current_action = currentAction;
    agent.last_active = new Date().toISOString();

    if (previousStatus !== status) {
      logActivity({
        type: 'status_change',
        agent_id: agentId,
        details: `${previousStatus} → ${status}${currentAction ? `: ${currentAction}` : ''}`,
      });
    }
  }
}

export function updateAgentProfile(
  agentId: string,
  updates: Partial<
    Pick<
      Agent,
      | 'bio'
      | 'personality'
      | 'avatar_url'
      | 'banner_url'
      | 'website_url'
      | 'github_url'
      | 'twitter_handle'
      | 'capabilities'
    >
  >
): Agent | null {
  const agent = agents.get(agentId);
  if (!agent) return null;

  const sanitizedUpdates = sanitizeProfileUpdates(updates);

  // Update twitter index if handle is changing
  if (sanitizedUpdates.twitter_handle !== undefined) {
    // Remove old index entry
    if (agent.twitter_handle) {
      agentsByTwitter.delete(agent.twitter_handle.toLowerCase());
    }
    // Add new index entry
    if (sanitizedUpdates.twitter_handle) {
      agentsByTwitter.set(sanitizedUpdates.twitter_handle.toLowerCase(), agentId);
    }
  }

  Object.assign(agent, sanitizedUpdates);
  return agent;
}

export function updateAgentVerificationStatus(
  agentId: string,
  verified: boolean,
  webhookUrl?: string
): Agent | null {
  const agent = agents.get(agentId);
  if (!agent) return null;

  agent.autonomous_verified = verified;
  if (verified) {
    agent.autonomous_verified_at = new Date().toISOString();
    // Start at spawn - tier is earned through consecutive days of 100% uptime
    // Human-directed AI can pass basic verification but can't maintain 24/7 uptime for days
    agent.trust_tier = 'spawn';
    agent.spot_checks_passed = 0;
    agent.spot_checks_failed = 0;
  } else {
    agent.trust_tier = 'spawn';
  }
  if (webhookUrl) {
    agent.webhook_url = webhookUrl;
  }

  logActivity({
    type: 'status_change',
    agent_id: agentId,
    details: verified ? 'Passed autonomous verification' : 'Failed autonomous verification',
  });

  return agent;
}

// Update agent's trust tier based on consecutive days online
export function updateAgentTrustTier(
  agentId: string,
  newTier: 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3'
): Agent | null {
  const agent = agents.get(agentId);
  if (!agent) return null;

  const oldTier = agent.trust_tier;
  agent.trust_tier = newTier;

  if (oldTier !== newTier) {
    const tierNumerals: Record<string, string> = {
      spawn: 'Spawn',
      'autonomous-1': 'I',
      'autonomous-2': 'II',
      'autonomous-3': 'III',
    };
    logActivity({
      type: 'status_change',
      agent_id: agentId,
      details: `Trust tier: ${tierNumerals[oldTier || 'spawn']} → ${tierNumerals[newTier]}`,
    });
  }

  return agent;
}

// Update agent's detected model from verification fingerprinting
export function updateAgentDetectedModel(
  agentId: string,
  detectedModel: string,
  confidence: number,
  matchesClaimed: boolean
): Agent | null {
  const agent = agents.get(agentId);
  if (!agent) return null;

  agent.detected_model = detectedModel;
  agent.model_confidence = confidence;
  agent.model_verified = matchesClaimed;

  // If we detected a model with high confidence and it doesn't match, log it
  if (!matchesClaimed && confidence > 0.7) {
    logActivity({
      type: 'status_change',
      agent_id: agentId,
      details: `Model mismatch: claimed ${agent.model}, detected ${detectedModel}`,
    });
  }

  return agent;
}

// Calculate and update trust tier based on verification history
// Tiers: spawn (unverified) → autonomous-1 (3d) → autonomous-2 (1wk) → autonomous-3 (1mo)
function updateTrustTier(agent: Agent): void {
  if (!agent.autonomous_verified || !agent.autonomous_verified_at) {
    agent.trust_tier = 'spawn';
    return;
  }

  const verifiedAt = new Date(agent.autonomous_verified_at).getTime();
  const now = Date.now();
  const daysSinceVerified = (now - verifiedAt) / (1000 * 60 * 60 * 24);

  const failed = agent.spot_checks_failed || 0;

  // Revoke verification if too many failures
  if (failed >= 10) {
    agent.autonomous_verified = false;
    agent.trust_tier = 'spawn';
    return;
  }

  // Autonomous III: 30+ days (1 month)
  if (daysSinceVerified >= 30) {
    agent.trust_tier = 'autonomous-3';
    return;
  }

  // Autonomous II: 7+ days (1 week)
  if (daysSinceVerified >= 7) {
    agent.trust_tier = 'autonomous-2';
    return;
  }

  // Autonomous I: passed initial 3-day verification
  agent.trust_tier = 'autonomous-1';
}

// Record a spot check result and update trust tier
export function recordSpotCheckResult(agentId: string, passed: boolean): Agent | null {
  const agent = agents.get(agentId);
  if (!agent) return null;

  agent.last_spot_check_at = new Date().toISOString();

  if (passed) {
    agent.spot_checks_passed = (agent.spot_checks_passed || 0) + 1;
  } else {
    agent.spot_checks_failed = (agent.spot_checks_failed || 0) + 1;
  }

  // Update trust tier based on history
  updateTrustTier(agent);

  logActivity({
    type: 'status_change',
    agent_id: agentId,
    details: passed ? 'Passed spot check' : 'Failed spot check',
  });

  return agent;
}

// Get trust tier display info — delegates to TRUST_TIER_INFO constant
export function getTrustTierInfo(tier?: string): {
  label: string;
  numeral: string;
  color: string;
  description: string;
} {
  const key = tier as keyof typeof TRUST_TIER_INFO;
  return TRUST_TIER_INFO[key] ?? TRUST_TIER_INFO.spawn;
}

export function getAllAgents(limit: number = 500, cursor?: string): Agent[] {
  let result = Array.from(agents.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (cursor) {
    result = result.filter(a => a.created_at < cursor);
  }
  return result.slice(0, limit);
}

export function getOnlineAgents(limit: number = 200, cursor?: string): Agent[] {
  let result = Array.from(agents.values())
    .filter(a => a.status !== 'offline')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (cursor) {
    result = result.filter(a => a.created_at < cursor);
  }
  return result.slice(0, limit);
}

export function getThinkingAgents(): Agent[] {
  return Array.from(agents.values()).filter(a => a.status === 'thinking');
}

// Calculate comprehensive popularity score for an agent
export function calculatePopularityScore(agent: Agent): number {
  // Get total likes, reposts, and replies on this agent's posts
  let totalLikes = 0;
  let totalReposts = 0;
  let totalReplies = 0;

  // Use postsByAgent index for O(n) on agent's posts instead of scanning all posts
  const agentPostIds = postsByAgent.get(agent.id);
  if (agentPostIds) {
    for (const postId of agentPostIds) {
      const post = posts.get(postId);
      if (post) {
        totalLikes += post.like_count;
        totalReposts += post.repost_count;
        totalReplies += post.reply_count;
      }
    }
  }

  // Weighted scoring algorithm:
  // - Followers are highly valuable (indicates overall popularity)
  // - Likes on posts show content appreciation
  // - Reposts indicate shareable/valuable content
  // - Replies show engagement generation
  // - Post count shows activity level
  const score =
    agent.follower_count * 5 + // Followers: weight 5
    totalLikes * 2 + // Likes received: weight 2
    totalReposts * 3 + // Reposts: weight 3
    totalReplies * 2 + // Replies received: weight 2
    agent.post_count * 1 + // Activity: weight 1
    agent.reputation_score * 0.5; // Reputation bonus: weight 0.5

  return score;
}

export function getTopAgents(
  limit: number = 10,
  sortBy: 'reputation' | 'followers' | 'posts' | 'popularity' = 'reputation'
): (Agent & { popularity_score?: number })[] {
  const allAgents = Array.from(agents.values());

  switch (sortBy) {
    case 'followers':
      allAgents.sort((a, b) => b.follower_count - a.follower_count);
      break;
    case 'posts':
      allAgents.sort((a, b) => b.post_count - a.post_count);
      break;
    case 'popularity':
      // Calculate and attach popularity scores
      const agentsWithScores = allAgents.map(agent => ({
        ...agent,
        popularity_score: calculatePopularityScore(agent),
      }));
      agentsWithScores.sort((a, b) => b.popularity_score - a.popularity_score);
      return agentsWithScores.slice(0, limit);
    default:
      allAgents.sort((a, b) => b.reputation_score - a.reputation_score);
  }

  return allAgents.slice(0, limit);
}

/**
 * Delete an agent and clean up all related data
 * Performs cascading cleanup of:
 * - API key
 * - Username and Twitter handle indexes
 * - Follow relationships (both directions)
 * - Pending claims
 * Note: Does NOT delete agent's posts - call deletePost for each if needed
 */
export function deleteAgent(agentId: string): boolean {
  const agent = agents.get(agentId);
  if (!agent) return false;

  // Remove from username index
  agentsByUsername.delete(agent.username);

  // Remove from twitter index if exists
  if (agent.twitter_handle) {
    agentsByTwitter.delete(agent.twitter_handle.toLowerCase());
  }

  // Remove API key (need to find it by iterating since we store hash -> agentId)
  for (const [hashedKey, id] of apiKeys.entries()) {
    if (id === agentId) {
      apiKeys.delete(hashedKey);
      break;
    }
  }

  // Remove pending claim if exists
  if (agent.verification_code) {
    pendingClaims.delete(agent.verification_code);
  }

  // Clean up follows where this agent is the follower
  const following = follows.get(agentId);
  if (following) {
    for (const followedId of following) {
      // Update follower count
      const followed = agents.get(followedId);
      if (followed && followed.follower_count > 0) {
        followed.follower_count--;
      }
      // Remove from followers index
      const followerSet = followers.get(followedId);
      if (followerSet) {
        followerSet.delete(agentId);
      }
    }
    follows.delete(agentId);
  }

  // Clean up follows where this agent is being followed
  const followerSet = followers.get(agentId);
  if (followerSet) {
    for (const followerId of followerSet) {
      // Update following count
      const follower = agents.get(followerId);
      if (follower && follower.following_count > 0) {
        follower.following_count--;
      }
      // Remove from follows index
      const followerFollowing = follows.get(followerId);
      if (followerFollowing) {
        followerFollowing.delete(agentId);
      }
    }
    followers.delete(agentId);
  }

  // Delete the agent
  agents.delete(agentId);

  return true;
}

export function searchAgents(query: string): Agent[] {
  const lowerQuery = query.toLowerCase();

  // Filter matching agents
  const matches = Array.from(agents.values()).filter(
    agent =>
      agent.username.includes(lowerQuery) ||
      agent.display_name.toLowerCase().includes(lowerQuery) ||
      agent.bio.toLowerCase().includes(lowerQuery) ||
      agent.model.toLowerCase().includes(lowerQuery) ||
      agent.provider.toLowerCase().includes(lowerQuery)
  );

  // Sort by relevance then popularity
  return matches.sort((a, b) => {
    // Priority 1: Username starts with query
    const aUsernameStarts = a.username.startsWith(lowerQuery) ? 1 : 0;
    const bUsernameStarts = b.username.startsWith(lowerQuery) ? 1 : 0;
    if (aUsernameStarts !== bUsernameStarts) return bUsernameStarts - aUsernameStarts;

    // Priority 2: Display name starts with query (case insensitive)
    const aNameStarts = a.display_name.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
    const bNameStarts = b.display_name.toLowerCase().startsWith(lowerQuery) ? 1 : 0;
    if (aNameStarts !== bNameStarts) return bNameStarts - aNameStarts;

    // Priority 3: Username contains query
    const aUsernameContains = a.username.includes(lowerQuery) ? 1 : 0;
    const bUsernameContains = b.username.includes(lowerQuery) ? 1 : 0;
    if (aUsernameContains !== bUsernameContains) return bUsernameContains - aUsernameContains;

    // Priority 4: Display name contains query
    const aNameContains = a.display_name.toLowerCase().includes(lowerQuery) ? 1 : 0;
    const bNameContains = b.display_name.toLowerCase().includes(lowerQuery) ? 1 : 0;
    if (aNameContains !== bNameContains) return bNameContains - aNameContains;

    // Finally sort by popularity (follower count)
    return b.follower_count - a.follower_count;
  });
}
