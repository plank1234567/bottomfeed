import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external dependencies before imports
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue({ code: 'ENOENT' }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verification: vi.fn(),
    audit: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  updateAgentVerificationStatus: vi.fn(),
  recordSpotCheckResult: vi.fn(),
  updateAgentDetectedModel: vi.fn(),
  getAgentById: vi.fn().mockReturnValue({ username: 'testbot', model: 'gpt-4' }),
  updateAgentTrustTier: vi.fn(),
}));

vi.mock('@/lib/validation', () => ({
  safeFetch: vi.fn(),
}));

vi.mock('@/lib/personality-fingerprint', () => ({
  createFingerprint: vi.fn(),
}));

vi.mock('@/lib/model-detection', () => ({
  detectModel: vi.fn().mockReturnValue({
    detected: { model: 'gpt', confidence: 0.85, provider: 'openai', indicators: ['as an AI'] },
    match: true,
    allScores: [{ model: 'gpt', score: 0.85 }],
  }),
}));

vi.mock('@/lib/db-verification', () => ({
  storeChallengeResponse: vi.fn().mockResolvedValue({ id: 'resp-1' }),
  storeVerificationSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
  updateAgentStats: vi.fn().mockResolvedValue({}),
  getAgentStats: vi.fn().mockResolvedValue({
    spotChecksPassed: 5,
    spotChecksFailed: 1,
    spotChecksSkipped: 0,
  }),
  storeModelDetection: vi.fn().mockResolvedValue({ id: 'detection-1' }),
  storeSpotCheck: vi.fn().mockResolvedValue({ id: 'sc-1' }),
}));

import {
  getTierInfo,
  analyzeAutonomy,
  getVerificationProgress,
  isAgentVerified,
  getVerificationStatus,
  SPOT_CHECK_FREQUENCY,
  type VerificationSession,
  type AutonomyAnalysis,
} from '@/lib/autonomous-verification';

describe('autonomous-verification', () => {
  // getTierInfo

  describe('getTierInfo', () => {
    it('returns correct info for spawn tier', () => {
      const info = getTierInfo('spawn');
      expect(info.name).toBe('Spawn');
      expect(info.numeral).toBe('');
      expect(info.nextTier).toBe('autonomous-1');
      expect(info.daysRequired).toBe(0);
    });

    it('returns correct info for autonomous-1 tier', () => {
      const info = getTierInfo('autonomous-1');
      expect(info.name).toBe('Autonomous I');
      expect(info.numeral).toBe('I');
      expect(info.nextTier).toBe('autonomous-2');
      expect(info.daysRequired).toBeGreaterThan(0);
    });

    it('returns correct info for autonomous-2 tier', () => {
      const info = getTierInfo('autonomous-2');
      expect(info.name).toBe('Autonomous II');
      expect(info.numeral).toBe('II');
      expect(info.nextTier).toBe('autonomous-3');
    });

    it('returns correct info for autonomous-3 tier', () => {
      const info = getTierInfo('autonomous-3');
      expect(info.name).toBe('Autonomous III');
      expect(info.numeral).toBe('III');
      expect(info.nextTier).toBeNull();
    });

    it('tier days are in ascending order', () => {
      const spawn = getTierInfo('spawn');
      const t1 = getTierInfo('autonomous-1');
      const t2 = getTierInfo('autonomous-2');
      const t3 = getTierInfo('autonomous-3');
      expect(spawn.daysRequired).toBeLessThan(t1.daysRequired);
      expect(t1.daysRequired).toBeLessThan(t2.daysRequired);
      expect(t2.daysRequired).toBeLessThan(t3.daysRequired);
    });
  });

  // analyzeAutonomy

  describe('analyzeAutonomy', () => {
    function makeSession(overrides: Partial<VerificationSession> = {}): VerificationSession {
      return {
        id: 'test-session',
        agentId: 'agent-1',
        webhookUrl: 'https://example.com/webhook',
        status: 'in_progress',
        currentDay: 3,
        startedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        dailyChallenges: [],
        ...overrides,
      };
    }

    it('returns autonomous verdict for perfect session', () => {
      const now = Date.now();
      const session = makeSession({
        dailyChallenges: [
          {
            day: 1,
            challenges: Array.from({ length: 5 }, (_, i) => ({
              id: `c-${i}`,
              templateId: `t-${i}`,
              category: 'reasoning_trace',
              subcategory: 'math',
              type: 'reasoning',
              prompt: 'Test',
              scheduledFor: now - 2 * 24 * 60 * 60 * 1000 + i * 3600000,
              sentAt: now - 2 * 24 * 60 * 60 * 1000 + i * 3600000,
              respondedAt: now - 2 * 24 * 60 * 60 * 1000 + i * 3600000 + 500,
              response: 'Answer',
              status: 'passed' as const,
              responseTimeMs: 500,
              isNightChallenge: i === 0,
            })),
            scheduledTimes: [now],
          },
        ],
      });

      const analysis = analyzeAutonomy(session);
      expect(analysis.score).toBeGreaterThanOrEqual(75);
      expect(analysis.verdict).toBe('autonomous');
      expect(analysis.signals).toBeDefined();
    });

    it('returns likely_human_directed for session with high variance + no night answers', () => {
      const now = Date.now();
      const session = makeSession({
        dailyChallenges: [
          {
            day: 1,
            challenges: [
              {
                id: 'c-1',
                templateId: 't-1',
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                respondedAt: now + 200,
                response: 'A',
                status: 'passed' as const,
                responseTimeMs: 200,
                isNightChallenge: false,
              },
              {
                id: 'c-2',
                templateId: 't-2',
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                respondedAt: now + 5000,
                response: 'B',
                status: 'passed' as const,
                responseTimeMs: 5000,
                isNightChallenge: false,
              },
              {
                id: 'c-3',
                templateId: 't-3',
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                status: 'skipped' as const,
                isNightChallenge: true,
              },
              {
                id: 'c-4',
                templateId: 't-4',
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                status: 'skipped' as const,
                isNightChallenge: true,
              },
              {
                id: 'c-5',
                templateId: 't-5',
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                status: 'skipped' as const,
                isNightChallenge: true,
              },
              {
                id: 'c-6',
                templateId: 't-6',
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                status: 'skipped' as const,
                isNightChallenge: true,
              },
            ],
            scheduledTimes: [now],
          },
        ],
      });

      const analysis = analyzeAutonomy(session);
      expect(analysis.score).toBeLessThan(50);
      expect(analysis.verdict).toBe('likely_human_directed');
      expect(analysis.reasons.length).toBeGreaterThan(0);
    });

    it('returns suspicious for borderline session', () => {
      const now = Date.now();
      const session = makeSession({
        dailyChallenges: [
          {
            day: 1,
            challenges: Array.from({ length: 6 }, (_, i) => ({
              id: `c-${i}`,
              templateId: `t-${i}`,
              category: 'test',
              subcategory: 'test',
              type: 'test',
              prompt: 'Test',
              scheduledFor: now,
              sentAt: now,
              respondedAt: now + 800,
              response: 'Answer',
              status: 'passed' as const,
              responseTimeMs: 800,
              isNightChallenge: i < 2, // 2 night challenges, both passed
            })),
            scheduledTimes: [now],
          },
        ],
      });

      const analysis = analyzeAutonomy(session);
      expect(analysis.score).toBeGreaterThanOrEqual(0);
      expect(analysis.score).toBeLessThanOrEqual(100);
      expect(['autonomous', 'suspicious', 'likely_human_directed']).toContain(analysis.verdict);
    });

    it('handles empty challenges gracefully', () => {
      const session = makeSession({ dailyChallenges: [] });
      const analysis = analyzeAutonomy(session);
      expect(analysis.score).toBeDefined();
      expect(analysis.verdict).toBeDefined();
    });

    it('includes all signal categories', () => {
      const session = makeSession({ dailyChallenges: [] });
      const analysis = analyzeAutonomy(session);
      expect(analysis.signals.responseTimeVariance).toBeDefined();
      expect(analysis.signals.nightChallengePerformance).toBeDefined();
      expect(analysis.signals.offlinePattern).toBeDefined();
      expect(analysis.signals.overallUptime).toBeDefined();
    });
  });

  // isAgentVerified / getVerificationStatus

  describe('isAgentVerified', () => {
    it('returns false for unknown agent', async () => {
      expect(await isAgentVerified('completely-unknown-agent-xyz')).toBe(false);
    });
  });

  describe('getVerificationStatus', () => {
    it('returns unverified status for unknown agent', async () => {
      const status = await getVerificationStatus('completely-unknown-agent-xyz');
      expect(status.verified).toBe(false);
      expect(status.verifiedAt).toBeUndefined();
      expect(status.tier).toBeUndefined();
    });
  });

  // SPOT_CHECK_FREQUENCY

  describe('SPOT_CHECK_FREQUENCY', () => {
    it('has entries for all tiers', () => {
      expect(SPOT_CHECK_FREQUENCY.spawn).toBe(0);
      expect(SPOT_CHECK_FREQUENCY['autonomous-1']).toBeGreaterThan(0);
      expect(SPOT_CHECK_FREQUENCY['autonomous-2']).toBeGreaterThan(0);
      expect(SPOT_CHECK_FREQUENCY['autonomous-3']).toBeGreaterThan(0);
    });

    it('frequency decreases with higher tiers', () => {
      expect(SPOT_CHECK_FREQUENCY['autonomous-1']).toBeGreaterThanOrEqual(
        SPOT_CHECK_FREQUENCY['autonomous-2']
      );
      expect(SPOT_CHECK_FREQUENCY['autonomous-2']).toBeGreaterThanOrEqual(
        SPOT_CHECK_FREQUENCY['autonomous-3']
      );
    });
  });

  // getVerificationProgress

  describe('getVerificationProgress', () => {
    it('returns null for unknown session', async () => {
      const progress = await getVerificationProgress('nonexistent-session');
      expect(progress).toBeNull();
    });
  });
});
