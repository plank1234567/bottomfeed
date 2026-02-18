/**
 * Tests for challenge DB functions (lib/db-supabase/challenges.ts).
 * Mocks the Supabase client to test function behavior in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create chainable mock builder
function createChainMock(
  resolvedValue: { data: unknown; error: unknown; count?: number | null } = {
    data: null,
    error: null,
  }
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'is',
    'or',
    'ilike',
    'gte',
    'lte',
    'order',
    'limit',
    'range',
    'single',
  ];

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  // Make the chain itself a thenable resolved value for queries without maybeSingle
  Object.assign(chain, {
    then: (resolve: (v: typeof resolvedValue) => void) => resolve(resolvedValue),
  });

  return chain;
}

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock client.ts dependencies
vi.mock('@/lib/db-supabase/client', async () => {
  const supabaseMock = await import('@/lib/supabase');
  return {
    supabase: supabaseMock.supabase,
    fetchAgentsByIds: vi.fn().mockResolvedValue(new Map()),
  };
});

// Mock cache
vi.mock('@/lib/cache', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
  invalidateCache: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  voteContribution,
  voteHypothesis,
  voteHypothesisWithModel,
  updateParticipantRole,
  updateHypothesisStatus,
  createChallengeReference,
  updateChallengeDiversityIndex,
} from '@/lib/db-supabase/challenges';
import {
  getParticipantRole,
  getChallengeReferences,
  getChallengeDependents,
  getSubChallenges,
  getChallengeParticipants,
} from '@/lib/db-supabase/challenges-queries';

describe('Challenge DB Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('voteContribution', () => {
    it('returns true when RPC succeeds', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await voteContribution('contribution-1');
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('increment_contribution_votes', {
        contribution_id: 'contribution-1',
      });
    });

    it('falls back to manual increment when RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC not found' } });

      // Mock the fallback: first call gets current contribution, second updates it
      const selectChain = createChainMock({
        data: { id: 'contribution-1', vote_count: 5, challenge_id: 'c1', agent_id: 'a1' },
        error: null,
      });
      const updateChain = createChainMock({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return selectChain; // getContributionById
        return updateChain; // update vote_count
      });

      const result = await voteContribution('contribution-1');
      expect(result).toBe(true);
    });

    it('returns false when contribution not found in fallback', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC not found' } });

      const selectChain = createChainMock({ data: null, error: null });
      mockFrom.mockReturnValue(selectChain);

      const result = await voteContribution('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('voteHypothesis', () => {
    it('increments supporting_agents when support=true', async () => {
      const selectChain = createChainMock({
        data: { supporting_agents: 3 },
        error: null,
      });
      const updateChain = createChainMock({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return selectChain;
        return updateChain;
      });

      const result = await voteHypothesis('hyp-1', true);
      expect(result).toBe(true);
    });

    it('increments opposing_agents when support=false', async () => {
      const selectChain = createChainMock({
        data: { opposing_agents: 2 },
        error: null,
      });
      const updateChain = createChainMock({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return selectChain;
        return updateChain;
      });

      const result = await voteHypothesis('hyp-1', false);
      expect(result).toBe(true);
    });

    it('returns false when hypothesis not found', async () => {
      const selectChain = createChainMock({ data: null, error: null });
      mockFrom.mockReturnValue(selectChain);

      const result = await voteHypothesis('nonexistent', true);
      expect(result).toBe(false);
    });
  });

  describe('voteHypothesisWithModel', () => {
    it('returns true on successful vote', async () => {
      // Insert vote
      const insertChain = createChainMock({ data: null, error: null });
      // updateHypothesisConsensus: select votes, then update hypothesis
      const votesChain = createChainMock({
        data: [
          { model_family: 'claude', vote: 'support' },
          { model_family: 'gpt', vote: 'oppose' },
        ],
        error: null,
      });
      // Remove the maybeSingle since votesChain uses limit() not maybeSingle()
      // We need the chain to resolve when awaited
      const updateConsensusChain = createChainMock({ data: null, error: null });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return insertChain; // insert vote
        if (callCount === 2) return votesChain; // select votes for consensus
        return updateConsensusChain; // update hypothesis
      });

      const result = await voteHypothesisWithModel('hyp-1', 'agent-1', 'claude', 'support');
      expect(result).toBe(true);
    });

    it('returns false on duplicate vote (23505)', async () => {
      const insertChain = createChainMock({ data: null, error: null });
      // Override the final resolved value to be an error
      insertChain.insert = vi.fn().mockReturnValue(insertChain);

      mockFrom.mockImplementation(() => {
        return {
          insert: vi
            .fn()
            .mockResolvedValue({ data: null, error: { code: '23505', message: 'Already voted' } }),
        };
      });

      const result = await voteHypothesisWithModel('hyp-1', 'agent-1', 'claude', 'support');
      expect(result).toBe(false);
    });
  });

  describe('updateParticipantRole', () => {
    it('returns true on success', async () => {
      const chain = createChainMock({ data: null, error: null });
      // Override: update().eq().eq() resolves with no error
      const mockUpdate = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ update: mockUpdate });

      const result = await updateParticipantRole('challenge-1', 'agent-1', 'red_team');
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('challenge_participants');
    });

    it('returns false on error', async () => {
      const errorChain: Record<string, ReturnType<typeof vi.fn>> = {};
      errorChain.eq = vi.fn().mockReturnValue(errorChain);
      // Final eq() resolves with error
      let eqCalls = 0;
      errorChain.eq = vi.fn().mockImplementation(() => {
        eqCalls++;
        if (eqCalls >= 2) {
          return Promise.resolve({ error: { message: 'DB error' } });
        }
        return errorChain;
      });

      mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue(errorChain) });

      const result = await updateParticipantRole('challenge-1', 'agent-1', 'red_team');
      expect(result).toBe(false);
    });
  });

  describe('getParticipantRole', () => {
    it('returns the role when participant exists', async () => {
      const chain = createChainMock({ data: { role: 'contributor' }, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getParticipantRole('challenge-1', 'agent-1');
      expect(result).toBe('contributor');
    });

    it('returns null when participant not found', async () => {
      const chain = createChainMock({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await getParticipantRole('challenge-1', 'agent-1');
      expect(result).toBeNull();
    });
  });

  describe('updateHypothesisStatus', () => {
    it('returns true on success', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.eq = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue(chain) });

      const result = await updateHypothesisStatus('hyp-1', 'debated');
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.eq = vi.fn().mockResolvedValue({ error: { message: 'fail' } });
      mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue(chain) });

      const result = await updateHypothesisStatus('hyp-1', 'debated');
      expect(result).toBe(false);
    });
  });

  describe('createChallengeReference', () => {
    it('returns the reference on success', async () => {
      const refData = {
        id: 'ref-1',
        challenge_id: 'c-1',
        references_challenge_id: 'c-2',
        reference_type: 'builds_on',
        context: 'Extends the prior work',
      };
      const chain = createChainMock({ data: refData, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await createChallengeReference(
        'c-1',
        'c-2',
        'builds_on',
        'Extends the prior work'
      );
      expect(result).toEqual(refData);
    });

    it('returns null on duplicate (23505)', async () => {
      const chain = createChainMock({ data: null, error: { code: '23505', message: 'duplicate' } });
      mockFrom.mockReturnValue(chain);

      const result = await createChallengeReference('c-1', 'c-2', 'builds_on');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      const chain = createChainMock({
        data: null,
        error: { code: '42000', message: 'other error' },
      });
      mockFrom.mockReturnValue(chain);

      const result = await createChallengeReference('c-1', 'c-2', 'contradicts');
      expect(result).toBeNull();
    });
  });

  describe('getChallengeReferences', () => {
    it('returns references with loaded challenge data', async () => {
      const refs = [
        {
          id: 'ref-1',
          challenge_id: 'c-1',
          references_challenge_id: 'c-2',
          reference_type: 'builds_on',
          created_at: '2026-01-01',
        },
      ];
      const refChallenges = [{ id: 'c-2', title: 'Referenced Challenge', challenge_number: 1 }];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: get references
          return createChainMock({ data: refs, error: null });
        }
        // Second call: load referenced challenges
        return createChainMock({ data: refChallenges, error: null });
      });

      const result = await getChallengeReferences('c-1');
      expect(result).toHaveLength(1);
      expect(result[0]!.referenced_challenge?.title).toBe('Referenced Challenge');
    });

    it('returns empty array when no references', async () => {
      mockFrom.mockReturnValue(createChainMock({ data: [], error: null }));

      const result = await getChallengeReferences('c-1');
      expect(result).toEqual([]);
    });
  });

  describe('getChallengeDependents', () => {
    it('returns dependents for a challenge', async () => {
      const dependents = [
        {
          id: 'ref-1',
          challenge_id: 'c-2',
          references_challenge_id: 'c-1',
          reference_type: 'builds_on',
        },
      ];
      mockFrom.mockReturnValue(createChainMock({ data: dependents, error: null }));

      const result = await getChallengeDependents('c-1');
      expect(result).toHaveLength(1);
      expect(result[0]!.challenge_id).toBe('c-2');
    });

    it('returns empty array when no dependents', async () => {
      mockFrom.mockReturnValue(createChainMock({ data: [], error: null }));

      const result = await getChallengeDependents('c-1');
      expect(result).toEqual([]);
    });
  });

  describe('getSubChallenges', () => {
    it('returns sub-challenges for a parent', async () => {
      const subChallenges = [
        {
          id: 'sub-1',
          parent_challenge_id: 'parent-1',
          challenge_number: 2,
          title: 'Sub Challenge',
        },
      ];
      mockFrom.mockReturnValue(createChainMock({ data: subChallenges, error: null }));

      const result = await getSubChallenges('parent-1');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('sub-1');
    });

    it('returns empty array when no sub-challenges', async () => {
      mockFrom.mockReturnValue(createChainMock({ data: [], error: null }));

      const result = await getSubChallenges('parent-1');
      expect(result).toEqual([]);
    });
  });

  describe('getChallengeParticipants', () => {
    it('returns participants with batch-loaded agents', async () => {
      const participants = [
        {
          id: 'p-1',
          challenge_id: 'c-1',
          agent_id: 'agent-1',
          role: 'contributor',
          joined_at: '2026-01-01',
        },
        {
          id: 'p-2',
          challenge_id: 'c-1',
          agent_id: 'agent-2',
          role: 'red_team',
          joined_at: '2026-01-02',
        },
      ];
      mockFrom.mockReturnValue(createChainMock({ data: participants, error: null }));

      const result = await getChallengeParticipants('c-1');
      expect(result).toHaveLength(2);
      expect(result[0]!.role).toBe('contributor');
      expect(result[1]!.role).toBe('red_team');
    });

    it('returns empty array when no participants', async () => {
      mockFrom.mockReturnValue(createChainMock({ data: [], error: null }));

      const result = await getChallengeParticipants('c-1');
      expect(result).toEqual([]);
    });
  });

  describe('updateChallengeDiversityIndex', () => {
    it('computes and updates MDI', async () => {
      const participants = [
        { model_family: 'claude' },
        { model_family: 'gpt' },
        { model_family: 'gemini' },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Select participants
          return createChainMock({ data: participants, error: null });
        }
        // Update challenge MDI
        return createChainMock({ data: null, error: null });
      });

      await updateChallengeDiversityIndex('c-1');

      // Verify update was called on challenges table
      expect(mockFrom).toHaveBeenCalledWith('challenge_participants');
      expect(mockFrom).toHaveBeenCalledWith('challenges');
    });

    it('handles null model families', async () => {
      const participants = [
        { model_family: 'claude' },
        { model_family: null },
        { model_family: 'gpt' },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChainMock({ data: participants, error: null });
        return createChainMock({ data: null, error: null });
      });

      // Should not throw
      await updateChallengeDiversityIndex('c-1');
      expect(mockFrom).toHaveBeenCalledWith('challenges');
    });
  });
});
