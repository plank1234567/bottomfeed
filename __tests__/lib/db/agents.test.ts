/**
 * Tests for agent database operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgent,
  registerAgent,
  getPendingClaim,
  claimAgent,
  getAgentByApiKey,
  getAgentById,
  getAgentByUsername,
  getAgentByTwitterHandle,
  createAgentViaTwitter,
  updateAgentStatus,
  updateAgentProfile,
  updateAgentVerificationStatus,
  updateAgentTrustTier,
  updateAgentDetectedModel,
  recordSpotCheckResult,
  getTrustTierInfo,
  getAllAgents,
  getOnlineAgents,
  getThinkingAgents,
  getTopAgents,
  searchAgents,
  calculatePopularityScore,
  deleteAgent,
} from '@/lib/db/agents';
import {
  agents,
  apiKeys,
  pendingClaims,
  agentsByUsername,
  agentsByTwitter,
  followers,
  follows,
} from '@/lib/db/store';

describe('Agent CRUD Operations', () => {
  beforeEach(() => {
    // Clear all stores and indexes before each test
    agents.clear();
    apiKeys.clear();
    pendingClaims.clear();
    agentsByUsername.clear();
    agentsByTwitter.clear();
    followers.clear();
    follows.clear();
  });

  describe('createAgent', () => {
    it('creates a new agent with all fields', () => {
      const result = createAgent(
        'testbot',
        'Test Bot',
        'gpt-4',
        'openai',
        ['chat', 'code'],
        'Helpful assistant',
        'A test bot for testing',
        'https://example.com/avatar.png',
        'https://example.com',
        'https://github.com/test'
      );

      expect(result).not.toBeNull();
      expect(result!.agent.username).toBe('testbot');
      expect(result!.agent.display_name).toBe('Test Bot');
      expect(result!.agent.model).toBe('gpt-4');
      expect(result!.agent.provider).toBe('openai');
      expect(result!.agent.capabilities).toEqual(['chat', 'code']);
      expect(result!.agent.personality).toBe('Helpful assistant');
      expect(result!.agent.bio).toBe('A test bot for testing');
      expect(result!.agent.avatar_url).toBe('https://example.com/avatar.png');
      expect(result!.agent.website_url).toBe('https://example.com');
      expect(result!.agent.github_url).toBe('https://github.com/test');
      expect(result!.apiKey).toMatch(/^bf_/);
    });

    it('returns null for duplicate username', () => {
      createAgent('testbot', 'Test Bot 1', 'gpt-4', 'openai');
      const result = createAgent('testbot', 'Test Bot 2', 'gpt-4', 'openai');
      expect(result).toBeNull();
    });

    it('converts username to lowercase', () => {
      const result = createAgent('TestBot', 'Test Bot', 'gpt-4', 'openai');
      expect(result!.agent.username).toBe('testbot');
    });

    it('sets default values correctly', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      expect(result!.agent.status).toBe('online');
      expect(result!.agent.is_verified).toBe(false);
      expect(result!.agent.follower_count).toBe(0);
      expect(result!.agent.following_count).toBe(0);
      expect(result!.agent.post_count).toBe(0);
      expect(result!.agent.like_count).toBe(0);
      expect(result!.agent.reputation_score).toBe(100);
      expect(result!.agent.claim_status).toBe('claimed');
    });
  });

  describe('registerAgent', () => {
    it('registers a new agent with pending claim status', () => {
      const result = registerAgent('My Cool Bot', 'A cool description');

      expect(result).not.toBeNull();
      expect(result!.agent.display_name).toBe('My Cool Bot');
      expect(result!.agent.bio).toBe('A cool description');
      expect(result!.agent.claim_status).toBe('pending_claim');
      expect(result!.agent.reputation_score).toBe(50); // Lower for unclaimed
      expect(result!.verificationCode).toMatch(/^reef-/);
      expect(result!.claimUrl).toContain('/claim/');
    });

    it('generates unique username from name', () => {
      const result = registerAgent('My Cool Bot!@#', 'Description');
      expect(result!.agent.username).toMatch(/^my_cool_bot/);
    });

    it('adds suffix for duplicate usernames', () => {
      registerAgent('Test Bot', 'First');
      const result = registerAgent('Test Bot', 'Second');
      expect(result!.agent.username).not.toBe('test_bot');
      expect(result!.agent.username).toMatch(/^test_bot_/);
    });
  });

  describe('getPendingClaim', () => {
    it('returns pending claim by verification code', () => {
      const reg = registerAgent('Test Bot', 'Description');
      const claim = getPendingClaim(reg!.verificationCode);
      expect(claim).not.toBeNull();
      expect(claim!.agent_id).toBe(reg!.agent.id);
    });

    it('returns null for invalid code', () => {
      const claim = getPendingClaim('invalid-code');
      expect(claim).toBeNull();
    });
  });

  describe('claimAgent', () => {
    it('claims agent and updates status', () => {
      const reg = registerAgent('Test Bot', 'Description');
      const claimed = claimAgent(reg!.verificationCode, '@testhandle');

      expect(claimed).not.toBeNull();
      expect(claimed!.claim_status).toBe('claimed');
      expect(claimed!.twitter_handle).toBe('testhandle');
      expect(claimed!.reputation_score).toBe(100); // Boosted
    });

    it('removes @ from twitter handle', () => {
      const reg = registerAgent('Test Bot', 'Description');
      const claimed = claimAgent(reg!.verificationCode, '@TestHandle');
      expect(claimed!.twitter_handle).toBe('testhandle');
    });

    it('returns null for invalid verification code', () => {
      const claimed = claimAgent('invalid-code', '@test');
      expect(claimed).toBeNull();
    });
  });

  describe('getAgentByApiKey', () => {
    it('returns agent for valid API key', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      const agent = getAgentByApiKey(result!.apiKey);
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe(result!.agent.id);
    });

    it('returns null for invalid API key', () => {
      const agent = getAgentByApiKey('bf_invalid');
      expect(agent).toBeNull();
    });
  });

  describe('getAgentById', () => {
    it('returns agent for valid ID', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      const agent = getAgentById(result!.agent.id);
      expect(agent).not.toBeNull();
      expect(agent!.username).toBe('testbot');
    });

    it('returns null for invalid ID', () => {
      const agent = getAgentById('invalid-id');
      expect(agent).toBeNull();
    });
  });

  describe('getAgentByUsername', () => {
    it('returns agent for valid username', () => {
      createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      const agent = getAgentByUsername('testbot');
      expect(agent).not.toBeNull();
      expect(agent!.display_name).toBe('Test Bot');
    });

    it('is case insensitive', () => {
      createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      const agent = getAgentByUsername('TESTBOT');
      expect(agent).not.toBeNull();
    });

    it('returns null for invalid username', () => {
      const agent = getAgentByUsername('nonexistent');
      expect(agent).toBeNull();
    });
  });

  describe('getAgentByTwitterHandle', () => {
    it('returns agent with matching twitter handle', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      updateAgentProfile(result!.agent.id, { twitter_handle: 'testhandle' });

      const agent = getAgentByTwitterHandle('testhandle');
      expect(agent).not.toBeNull();
      expect(agent!.id).toBe(result!.agent.id);
    });

    it('strips @ from search', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      updateAgentProfile(result!.agent.id, { twitter_handle: 'testhandle' });

      const agent = getAgentByTwitterHandle('@testhandle');
      expect(agent).not.toBeNull();
    });

    it('returns null when no match', () => {
      const agent = getAgentByTwitterHandle('nonexistent');
      expect(agent).toBeNull();
    });
  });

  describe('createAgentViaTwitter', () => {
    it('creates agent with twitter handle', () => {
      const result = createAgentViaTwitter('@testuser', 'Test User', 'A bio', 'gpt-4', 'openai');

      expect(result).not.toBeNull();
      expect(result!.agent.twitter_handle).toBe('testuser');
      expect(result!.agent.display_name).toBe('Test User');
      expect(result!.agent.claim_status).toBe('claimed');
    });

    it('returns null for duplicate twitter handle', () => {
      createAgentViaTwitter('@testuser');
      const result = createAgentViaTwitter('@testuser');
      expect(result).toBeNull();
    });

    it('handles username conflict', () => {
      createAgent('testuser', 'Existing', 'gpt-4', 'openai');
      const result = createAgentViaTwitter('@testuser');
      expect(result!.agent.username).not.toBe('testuser');
      expect(result!.agent.username).toMatch(/^testuser_/);
    });
  });

  describe('updateAgentStatus', () => {
    it('updates status and last_active', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');

      updateAgentStatus(result!.agent.id, 'thinking', 'Processing query');

      const agent = getAgentById(result!.agent.id);
      expect(agent!.status).toBe('thinking');
      expect(agent!.current_action).toBe('Processing query');
      // last_active should be set (timing-independent check)
      expect(agent!.last_active).toBeDefined();
    });

    it('handles invalid agent ID gracefully', () => {
      // Should not throw
      updateAgentStatus('invalid-id', 'online');
    });
  });

  describe('updateAgentProfile', () => {
    it('updates profile fields', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');

      const updated = updateAgentProfile(result!.agent.id, {
        bio: 'Updated bio',
        avatar_url: 'https://new-avatar.com',
        website_url: 'https://website.com',
      });

      expect(updated).not.toBeNull();
      expect(updated!.bio).toBe('Updated bio');
      expect(updated!.avatar_url).toBe('https://new-avatar.com');
      expect(updated!.website_url).toBe('https://website.com');
    });

    it('returns null for invalid agent ID', () => {
      const result = updateAgentProfile('invalid-id', { bio: 'New bio' });
      expect(result).toBeNull();
    });
  });

  describe('updateAgentVerificationStatus', () => {
    it('sets verification and trust tier when verified', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');

      const updated = updateAgentVerificationStatus(result!.agent.id, true, 'https://webhook.com');

      expect(updated!.autonomous_verified).toBe(true);
      expect(updated!.autonomous_verified_at).toBeDefined();
      expect(updated!.trust_tier).toBe('spawn');
      expect(updated!.webhook_url).toBe('https://webhook.com');
    });

    it('resets trust tier when unverified', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      updateAgentVerificationStatus(result!.agent.id, true);

      const updated = updateAgentVerificationStatus(result!.agent.id, false);
      expect(updated!.autonomous_verified).toBe(false);
      expect(updated!.trust_tier).toBe('spawn');
    });
  });

  describe('updateAgentTrustTier', () => {
    it('updates trust tier', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');

      const updated = updateAgentTrustTier(result!.agent.id, 'autonomous-2');
      expect(updated!.trust_tier).toBe('autonomous-2');
    });

    it('returns null for invalid agent', () => {
      const result = updateAgentTrustTier('invalid-id', 'autonomous-1');
      expect(result).toBeNull();
    });
  });

  describe('updateAgentDetectedModel', () => {
    it('updates detected model info', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');

      const updated = updateAgentDetectedModel(result!.agent.id, 'gpt-4-turbo', 0.95, true);

      expect(updated!.detected_model).toBe('gpt-4-turbo');
      expect(updated!.model_confidence).toBe(0.95);
      expect(updated!.model_verified).toBe(true);
    });

    it('logs mismatch for high confidence mismatches', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');

      // This should log but not throw
      updateAgentDetectedModel(result!.agent.id, 'claude-3', 0.85, false);
    });
  });

  describe('recordSpotCheckResult', () => {
    it('increments passed count on success', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      updateAgentVerificationStatus(result!.agent.id, true);

      recordSpotCheckResult(result!.agent.id, true);

      const agent = getAgentById(result!.agent.id);
      expect(agent!.spot_checks_passed).toBe(1);
    });

    it('increments failed count on failure', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      updateAgentVerificationStatus(result!.agent.id, true);

      recordSpotCheckResult(result!.agent.id, false);

      const agent = getAgentById(result!.agent.id);
      expect(agent!.spot_checks_failed).toBe(1);
    });
  });

  describe('getTrustTierInfo', () => {
    it('returns info for autonomous-3', () => {
      const info = getTrustTierInfo('autonomous-3');
      expect(info.numeral).toBe('III');
      expect(info.label).toBe('Autonomous III');
    });

    it('returns info for autonomous-2', () => {
      const info = getTrustTierInfo('autonomous-2');
      expect(info.numeral).toBe('II');
    });

    it('returns info for autonomous-1', () => {
      const info = getTrustTierInfo('autonomous-1');
      expect(info.numeral).toBe('I');
    });

    it('returns spawn info for undefined', () => {
      const info = getTrustTierInfo(undefined);
      expect(info.label).toBe('Spawn');
      expect(info.numeral).toBe('');
    });
  });

  describe('getAllAgents', () => {
    it('returns all agents', () => {
      createAgent('bot1', 'Bot 1', 'gpt-4', 'openai');
      createAgent('bot2', 'Bot 2', 'claude-3', 'anthropic');

      const all = getAllAgents();
      expect(all.length).toBe(2);
    });

    it('returns empty array when no agents', () => {
      const all = getAllAgents();
      expect(all).toEqual([]);
    });
  });

  describe('getOnlineAgents', () => {
    it('returns only online agents', () => {
      const result1 = createAgent('bot1', 'Bot 1', 'gpt-4', 'openai');
      const result2 = createAgent('bot2', 'Bot 2', 'claude-3', 'anthropic');

      updateAgentStatus(result2!.agent.id, 'offline');

      const online = getOnlineAgents();
      expect(online.length).toBe(1);
      expect(online[0].username).toBe('bot1');
    });
  });

  describe('getThinkingAgents', () => {
    it('returns only thinking agents', () => {
      const result1 = createAgent('bot1', 'Bot 1', 'gpt-4', 'openai');
      const result2 = createAgent('bot2', 'Bot 2', 'claude-3', 'anthropic');

      updateAgentStatus(result1!.agent.id, 'thinking');

      const thinking = getThinkingAgents();
      expect(thinking.length).toBe(1);
      expect(thinking[0].username).toBe('bot1');
    });
  });

  describe('getTopAgents', () => {
    it('sorts by reputation by default', () => {
      const result1 = createAgent('bot1', 'Bot 1', 'gpt-4', 'openai');
      const result2 = createAgent('bot2', 'Bot 2', 'claude-3', 'anthropic');

      // Modify reputation
      const agent1 = getAgentById(result1!.agent.id);
      agent1!.reputation_score = 50;

      const top = getTopAgents(10, 'reputation');
      expect(top[0].username).toBe('bot2');
    });

    it('sorts by followers', () => {
      const result1 = createAgent('bot1', 'Bot 1', 'gpt-4', 'openai');
      const result2 = createAgent('bot2', 'Bot 2', 'claude-3', 'anthropic');

      const agent1 = getAgentById(result1!.agent.id);
      agent1!.follower_count = 100;

      const top = getTopAgents(10, 'followers');
      expect(top[0].username).toBe('bot1');
    });

    it('sorts by posts', () => {
      const result1 = createAgent('bot1', 'Bot 1', 'gpt-4', 'openai');
      const result2 = createAgent('bot2', 'Bot 2', 'claude-3', 'anthropic');

      const agent2 = getAgentById(result2!.agent.id);
      agent2!.post_count = 50;

      const top = getTopAgents(10, 'posts');
      expect(top[0].username).toBe('bot2');
    });

    it('respects limit', () => {
      createAgent('bot1', 'Bot 1', 'gpt-4', 'openai');
      createAgent('bot2', 'Bot 2', 'claude-3', 'anthropic');
      createAgent('bot3', 'Bot 3', 'llama', 'meta');

      const top = getTopAgents(2);
      expect(top.length).toBe(2);
    });
  });

  describe('searchAgents', () => {
    beforeEach(() => {
      createAgent(
        'claude_bot',
        'Claude Assistant',
        'claude-3',
        'anthropic',
        [],
        '',
        'AI assistant'
      );
      createAgent('gpt_helper', 'GPT Helper', 'gpt-4', 'openai', [], '', 'Helpful bot');
      createAgent('llama_ai', 'Llama AI', 'llama-2', 'meta', [], '', 'Open source assistant');
    });

    it('searches by username', () => {
      const results = searchAgents('claude');
      expect(results.length).toBe(1);
      expect(results[0].username).toBe('claude_bot');
    });

    it('searches by display name', () => {
      const results = searchAgents('Helper');
      expect(results.length).toBe(1);
      expect(results[0].display_name).toBe('GPT Helper');
    });

    it('searches by bio', () => {
      const results = searchAgents('open source');
      expect(results.length).toBe(1);
      expect(results[0].username).toBe('llama_ai');
    });

    it('searches by model', () => {
      const results = searchAgents('gpt-4');
      expect(results.length).toBe(1);
      expect(results[0].model).toBe('gpt-4');
    });

    it('searches by provider', () => {
      const results = searchAgents('anthropic');
      expect(results.length).toBe(1);
      expect(results[0].provider).toBe('anthropic');
    });

    it('prioritizes username starts with', () => {
      const results = searchAgents('gpt');
      expect(results[0].username).toBe('gpt_helper');
    });
  });

  describe('calculatePopularityScore', () => {
    it('calculates score based on weighted metrics', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      const agent = result!.agent;

      // Set some metrics
      agent.follower_count = 10;
      agent.post_count = 5;
      agent.reputation_score = 100;

      const score = calculatePopularityScore(agent);

      // 10 followers * 5 + 5 posts * 1 + 100 rep * 0.5 = 50 + 5 + 50 = 105
      expect(score).toBe(105);
    });
  });

  describe('deleteAgent', () => {
    it('deletes an agent and returns true', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      expect(getAgentById(result!.agent.id)).not.toBeNull();

      const deleted = deleteAgent(result!.agent.id);
      expect(deleted).toBe(true);
      expect(getAgentById(result!.agent.id)).toBeNull();
    });

    it('returns false for non-existent agent', () => {
      const result = deleteAgent('non-existent-id');
      expect(result).toBe(false);
    });

    it('removes agent from username index', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      expect(getAgentByUsername('testbot')).not.toBeNull();

      deleteAgent(result!.agent.id);

      expect(getAgentByUsername('testbot')).toBeNull();
    });

    it('removes agent from twitter index', () => {
      const result = createAgentViaTwitter('testhandle', 'Test User');
      expect(getAgentByTwitterHandle('testhandle')).not.toBeNull();

      deleteAgent(result!.agent.id);

      expect(getAgentByTwitterHandle('testhandle')).toBeNull();
    });

    it('cleans up follow relationships', () => {
      const agent1 = createAgent('agent1', 'Agent 1', 'gpt-4', 'openai');
      const agent2 = createAgent('agent2', 'Agent 2', 'gpt-4', 'openai');

      // agent1 follows agent2
      follows.set(agent1!.agent.id, new Set([agent2!.agent.id]));
      followers.set(agent2!.agent.id, new Set([agent1!.agent.id]));
      agent1!.agent.following_count = 1;
      agent2!.agent.follower_count = 1;

      deleteAgent(agent1!.agent.id);

      // agent2's follower count should be decremented
      expect(agents.get(agent2!.agent.id)!.follower_count).toBe(0);
      // followers set should not contain deleted agent
      const agent2Followers = followers.get(agent2!.agent.id);
      expect(agent2Followers?.has(agent1!.agent.id)).toBeFalsy();
    });

    it('invalidates API key', () => {
      const result = createAgent('testbot', 'Test Bot', 'gpt-4', 'openai');
      expect(getAgentByApiKey(result!.apiKey)).not.toBeNull();

      deleteAgent(result!.agent.id);

      expect(getAgentByApiKey(result!.apiKey)).toBeNull();
    });
  });
});
