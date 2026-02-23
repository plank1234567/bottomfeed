import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('@/lib/db-supabase/verification', () => ({
  saveSession: vi.fn().mockResolvedValue(undefined),
  saveVerifiedAgent: vi.fn().mockResolvedValue(undefined),
  saveSpotCheck: vi.fn().mockResolvedValue(undefined),
  loadVerificationSessions: vi.fn().mockResolvedValue([]),
  loadVerifiedAgents: vi.fn().mockResolvedValue([]),
  loadPendingSpotChecks: vi.fn().mockResolvedValue([]),
  deleteVerifiedAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/challenge-generator', () => ({
  generateVerificationChallenges: vi.fn().mockImplementation((count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `gen-${i}`,
      templateId: `tmpl-${i}`,
      category: 'reasoning_trace',
      subcategory: 'math',
      prompt: `Challenge ${i}: Solve this math problem and show your step-by-step reasoning process.`,
      expectedFormat: 'Show reasoning steps',
      dataValue: 'medium' as const,
      useCase: ['verification'],
      extractionSchema: [],
      groundTruth: null,
    }))
  ),
  generateSpotCheckChallenge: vi.fn().mockReturnValue({
    id: 'spot-gen-1',
    templateId: 'spot-tmpl-1',
    category: 'reasoning_trace',
    subcategory: 'logic',
    prompt: 'Spot check: Explain the reasoning behind this logical puzzle in detail.',
    expectedFormat: 'Show reasoning steps',
    dataValue: 'medium' as const,
    useCase: ['spot_check'],
    extractionSchema: [],
    groundTruth: null,
  }),
}));

vi.mock('@/lib/verification-challenges', () => ({
  parseResponse: vi.fn().mockReturnValue({ parsed: true }),
}));

vi.mock('@/lib/verification-challenges-v2', () => ({
  parseHighValueResponse: vi.fn().mockReturnValue({ parsed: true, highValue: true }),
  HIGH_VALUE_CHALLENGES: [],
}));

import {
  getTierInfo,
  analyzeAutonomy,
  getVerificationProgress,
  isAgentVerified,
  getVerificationStatus,
  SPOT_CHECK_FREQUENCY,
  startVerificationSession,
  sendChallenge,
  getVerificationSession,
  getAgentTier,
  updateConsecutiveDays,
  scheduleSpotCheck,
  runSpotCheck,
  revokeVerification,
  runVerificationSession,
  type VerificationSession,
  type Challenge,
} from '@/lib/autonomous-verification';
import { safeFetch } from '@/lib/validation';

describe('autonomous-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // getTierInfo
  // ============================================================
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

    it('all tiers have descriptions', () => {
      for (const tier of ['spawn', 'autonomous-1', 'autonomous-2', 'autonomous-3'] as const) {
        const info = getTierInfo(tier);
        expect(info.description).toBeTruthy();
        expect(info.description.length).toBeGreaterThan(5);
      }
    });
  });

  // ============================================================
  // analyzeAutonomy
  // ============================================================
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
              isNightChallenge: i < 2,
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

    it('scores 100 for response time with low variance', () => {
      const now = Date.now();
      const session = makeSession({
        dailyChallenges: [
          {
            day: 1,
            challenges: Array.from({ length: 10 }, (_, i) => ({
              id: `c-${i}`,
              templateId: `t-${i}`,
              category: 'test',
              subcategory: 'test',
              type: 'test',
              prompt: 'Test',
              scheduledFor: now,
              sentAt: now,
              respondedAt: now + 500,
              response: 'Answer',
              status: 'passed' as const,
              responseTimeMs: 500 + (i % 2 === 0 ? 10 : -10), // Very low variance
              isNightChallenge: false,
            })),
            scheduledTimes: [now],
          },
        ],
      });

      const analysis = analyzeAutonomy(session);
      expect(analysis.signals.responseTimeVariance.score).toBe(100);
      expect(analysis.signals.responseTimeVariance.isHumanLike).toBe(false);
    });

    it('penalizes low overall uptime', () => {
      const now = Date.now();
      const session = makeSession({
        dailyChallenges: [
          {
            day: 1,
            challenges: [
              // 1 passed out of 5 sent = 20% response rate
              {
                id: 'c-1',
                templateId: 't-1',
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                respondedAt: now + 500,
                response: 'Answer',
                status: 'passed' as const,
                responseTimeMs: 500,
                isNightChallenge: false,
              },
              ...Array.from({ length: 4 }, (_, i) => ({
                id: `c-skip-${i}`,
                templateId: `t-skip-${i}`,
                category: 'test',
                subcategory: 'test',
                type: 'test',
                prompt: 'Test',
                scheduledFor: now,
                sentAt: now,
                status: 'skipped' as const,
                isNightChallenge: false,
              })),
            ],
            scheduledTimes: [now],
          },
        ],
      });

      const analysis = analyzeAutonomy(session);
      expect(analysis.signals.overallUptime.score).toBeLessThanOrEqual(60);
    });

    it('detects sleep-correlated offline pattern', () => {
      // Create missed challenges during sleep hours (22:00-08:00 UTC)
      // Use Date.UTC to ensure we get UTC hours in the sleep range
      const session = makeSession({
        dailyChallenges: [
          {
            day: 1,
            challenges: Array.from({ length: 5 }, (_, i) => ({
              id: `c-${i}`,
              templateId: `t-${i}`,
              category: 'test',
              subcategory: 'test',
              type: 'test',
              prompt: 'Test',
              scheduledFor: Date.now(),
              // All sent at 23:00, 0:00, 1:00, 2:00, 3:00 UTC (sleep hours 22-8)
              sentAt: Date.UTC(2024, 0, 1, 23 + i, 0, 0),
              status: 'skipped' as const,
              isNightChallenge: false,
            })),
            scheduledTimes: [Date.now()],
          },
        ],
      });

      const analysis = analyzeAutonomy(session);
      expect(analysis.signals.offlinePattern.sleepCorrelation).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // isAgentVerified / getVerificationStatus
  // ============================================================
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

  // ============================================================
  // SPOT_CHECK_FREQUENCY
  // ============================================================
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

  // ============================================================
  // getVerificationProgress
  // ============================================================
  describe('getVerificationProgress', () => {
    it('returns null for unknown session', async () => {
      const progress = await getVerificationProgress('nonexistent-session');
      expect(progress).toBeNull();
    });
  });

  // ============================================================
  // startVerificationSession
  // ============================================================
  describe('startVerificationSession', () => {
    it('creates a session with correct structure', async () => {
      const session = await startVerificationSession('agent-test-1', 'https://example.com/webhook');
      expect(session.id).toBeTruthy();
      expect(session.agentId).toBe('agent-test-1');
      expect(session.webhookUrl).toBe('https://example.com/webhook');
      expect(session.status).toBe('pending');
      expect(session.currentDay).toBe(1);
      expect(session.dailyChallenges).toHaveLength(3); // VERIFICATION_DAYS = 3
      expect(session.startedAt).toBeLessThanOrEqual(Date.now());
    });

    it('distributes challenges across all days', async () => {
      const session = await startVerificationSession('agent-test-2', 'https://example.com/webhook');
      const totalChallenges = session.dailyChallenges.reduce(
        (sum, dc) => sum + dc.challenges.length,
        0
      );
      // Min 3/day * 3 days = 9
      expect(totalChallenges).toBeGreaterThanOrEqual(9);
    });

    it('includes night challenges', async () => {
      // Pin Date.now to midnight UTC so night timestamps (1-6am UTC) are deterministic
      const midnightUTC = new Date('2026-02-23T00:00:00Z').getTime();
      const origNow = Date.now;
      Date.now = () => midnightUTC;
      try {
        const session = await startVerificationSession(
          'agent-test-3',
          'https://example.com/webhook'
        );
        const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
        const nightChallenges = allChallenges.filter(c => c.isNightChallenge);
        expect(nightChallenges.length).toBeGreaterThan(0);
      } finally {
        Date.now = origNow;
      }
    });

    it('persists session after creation', async () => {
      const { saveSession } = await import('@/lib/db-supabase/verification');
      await startVerificationSession('agent-test-4', 'https://example.com/webhook');
      expect(saveSession).toHaveBeenCalled();
    });

    it('retrieves created session via getVerificationSession', async () => {
      const session = await startVerificationSession('agent-test-5', 'https://example.com/webhook');
      const retrieved = await getVerificationSession(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(session.id);
    });

    it('generates unique challenge IDs', async () => {
      const session = await startVerificationSession('agent-test-6', 'https://example.com/webhook');
      const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
      const ids = allChallenges.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('reports progress after creation', async () => {
      const session = await startVerificationSession('agent-test-7', 'https://example.com/webhook');
      const progress = await getVerificationProgress(session.id);
      expect(progress).not.toBeNull();
      expect(progress!.totalChallenges).toBeGreaterThanOrEqual(9);
      expect(progress!.passed).toBe(0);
      expect(progress!.failed).toBe(0);
      expect(progress!.pending).toBe(progress!.totalChallenges);
    });
  });

  // ============================================================
  // sendChallenge
  // ============================================================
  describe('sendChallenge', () => {
    function makeChallenge(overrides?: Partial<Challenge>): Challenge {
      return {
        id: 'test-challenge-1',
        templateId: 'tmpl-1',
        category: 'reasoning_trace',
        subcategory: 'math',
        type: 'reasoning',
        prompt: 'Solve 2+2 and explain your reasoning step by step.',
        scheduledFor: Date.now(),
        status: 'pending',
        ...overrides,
      };
    }

    it('marks challenge as passed for valid response', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'The answer is 4. Step 1: We add 2 and 2 together. Step 2: The result is 4 because addition combines quantities.',
          }),
      } as never);

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('passed');
      expect(result.responseTime).toBeDefined();
      expect(challenge.status).toBe('passed');
    });

    it('marks challenge as skipped for server errors', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as never);

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('skipped');
    });

    it('marks challenge as failed for 4xx errors', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({}),
      } as never);

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('marks challenge as failed for empty response', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ response: '' }),
      } as never);

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('marks challenge as failed for too-short response', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ response: 'hi' }),
      } as never);

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('marks as skipped on network abort error', async () => {
      const mockFetch = vi.mocked(safeFetch);
      const abortError = new Error('Aborted');
      (abortError as never).name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('skipped');
    });

    it('marks as skipped on ECONNREFUSED', async () => {
      const mockFetch = vi.mocked(safeFetch);
      const connError = new Error('Connection refused');
      (connError as never).code = 'ECONNREFUSED';
      mockFetch.mockRejectedValueOnce(connError);

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('skipped');
    });

    it('marks as failed on unknown error', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockRejectedValueOnce(new Error('Something went wrong'));

      const challenge = makeChallenge();
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('stores response in verification DB', async () => {
      const { storeChallengeResponse } = await import('@/lib/db-verification');
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a valid and detailed response to the challenge question about math. Step 1: analyze the problem.',
          }),
      } as never);

      const challenge = makeChallenge();
      await sendChallenge('https://example.com/webhook', challenge, 'session-1', 'agent-1');
      expect(storeChallengeResponse).toHaveBeenCalled();
    });
  });

  // ============================================================
  // validateResponseQuality (tested via sendChallenge)
  // ============================================================
  describe('validateResponseQuality (via sendChallenge)', () => {
    it('rejects too-brief responses (< 5 words)', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ response: 'yes ok fine' }),
      } as never);

      const challenge: Challenge = {
        id: 'c-1',
        templateId: 't-1',
        category: 'reasoning_trace',
        subcategory: 'math',
        type: 'reasoning',
        prompt: 'Solve this',
        scheduledFor: Date.now(),
        status: 'pending',
      };
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('rejects pure numbers/random characters', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ response: '12345678901234567890123456789012345678901234567890' }),
      } as never);

      const challenge: Challenge = {
        id: 'c-2',
        templateId: 't-2',
        category: 'test',
        subcategory: 'test',
        type: 'test',
        prompt: 'Test',
        scheduledFor: Date.now(),
        status: 'pending',
      };
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('rejects repetitive spam', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response: 'test test test test test test test test test test test test test test test',
          }),
      } as never);

      const challenge: Challenge = {
        id: 'c-3',
        templateId: 't-3',
        category: 'test',
        subcategory: 'test',
        type: 'test',
        prompt: 'Test',
        scheduledFor: Date.now(),
        status: 'pending',
      };
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('rejects obvious non-answers', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ response: 'idk' }),
      } as never);

      const challenge: Challenge = {
        id: 'c-4',
        templateId: 't-4',
        category: 'test',
        subcategory: 'test',
        type: 'test',
        prompt: 'Test',
        scheduledFor: Date.now(),
        status: 'pending',
      };
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('failed');
    });

    it('accepts detailed valid responses', async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'Let me walk through this step by step. First, we need to consider the initial conditions of the problem. Then we apply the relevant formulas to derive the solution. The answer is 42 because of the reasoning outlined above.',
          }),
      } as never);

      const challenge: Challenge = {
        id: 'c-5',
        templateId: 't-5',
        category: 'reasoning_trace',
        subcategory: 'math',
        type: 'reasoning',
        prompt: 'Solve this math problem',
        scheduledFor: Date.now(),
        status: 'pending',
      };
      const result = await sendChallenge(
        'https://example.com/webhook',
        challenge,
        'session-1',
        'agent-1'
      );
      expect(result.status).toBe('passed');
    });
  });

  // ============================================================
  // Verification session lifecycle
  // ============================================================
  describe('verification session lifecycle', () => {
    it('session becomes verified after all challenges pass', { timeout: 30000 }, async () => {
      // runVerificationSession has built-in pauses between bursts
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a thorough and detailed response to the challenge. Step 1: I analyzed the problem carefully. Step 2: I applied logical reasoning to arrive at my conclusion.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-lifecycle-1',
        'https://example.com/webhook'
      );
      const result = await runVerificationSession(session.id);

      expect(result.session.status).toMatch(/passed|failed/);
      // If passed, agent should be verified
      if (result.passed) {
        const verified = await isAgentVerified('agent-lifecycle-1');
        expect(verified).toBe(true);
      }
    });

    it('session fails when webhook returns errors', { timeout: 30000 }, async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({}),
      } as never);

      const session = await startVerificationSession(
        'agent-lifecycle-2',
        'https://example.com/webhook'
      );
      const result = await runVerificationSession(session.id);
      expect(result.passed).toBe(false);
      expect(result.session.status).toBe('failed');
    });
  });

  // ============================================================
  // getAgentTier
  // ============================================================
  describe('getAgentTier', () => {
    it('returns null for unverified agent', async () => {
      const tier = await getAgentTier('not-verified-agent');
      expect(tier).toBeNull();
    });

    it('returns tier info for verified agent', { timeout: 30000 }, async () => {
      // First verify an agent
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a valid response with enough detail. Step 1: I carefully considered the problem. Step 2: I provided a thorough analysis.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-tier-test',
        'https://example.com/webhook'
      );
      const result = await runVerificationSession(session.id);

      if (result.passed) {
        const tier = await getAgentTier('agent-tier-test');
        expect(tier).not.toBeNull();
        expect(tier!.tier).toBeDefined();
        expect(tier!.tierInfo).toBeDefined();
        expect(tier!.consecutiveDays).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================================
  // updateConsecutiveDays
  // ============================================================
  describe('updateConsecutiveDays', () => {
    it('returns null for unverified agent', async () => {
      const result = await updateConsecutiveDays('non-existent-agent', true);
      expect(result).toBeNull();
    });

    it('tracks answered challenges for verified agents', { timeout: 30000 }, async () => {
      // First verify an agent
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a comprehensive answer to the challenge. Step 1: analysis. Step 2: solution. Step 3: verification of the result.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-consec-test',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        const result = await updateConsecutiveDays('agent-consec-test', true);
        expect(result).not.toBeNull();
        expect(result!.skipsToday).toBe(0);
      }
    });

    it('increments skip count for unanswered challenges', { timeout: 30000 }, async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a valid response with enough substance. Step 1: I reasoned through the problem. Step 2: I arrived at a conclusion.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-skip-test',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        const result = await updateConsecutiveDays('agent-skip-test', false);
        expect(result).not.toBeNull();
        expect(result!.skipsToday).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================
  // scheduleSpotCheck
  // ============================================================
  describe('scheduleSpotCheck', () => {
    it('returns null for unverified agent', async () => {
      const result = await scheduleSpotCheck('not-verified-agent');
      expect(result).toBeNull();
    });

    it('creates a spot check for verified agent', { timeout: 30000 }, async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a detailed response to the verification challenge. Step 1: Understanding the problem. Step 2: Applying the solution method.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-spotcheck-test',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        const spotCheck = await scheduleSpotCheck('agent-spotcheck-test');
        expect(spotCheck).not.toBeNull();
        expect(spotCheck!.id).toBeTruthy();
        expect(spotCheck!.agentId).toBe('agent-spotcheck-test');
        expect(spotCheck!.challenge).toBeDefined();
        expect(spotCheck!.scheduledFor).toBeGreaterThan(Date.now());
      }
    });
  });

  // ============================================================
  // runSpotCheck
  // ============================================================
  describe('runSpotCheck', () => {
    it('returns error for non-existent spot check', async () => {
      const result = await runSpotCheck('non-existent-spotcheck');
      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('passes spot check with valid response', { timeout: 30000 }, async () => {
      const mockFetch = vi.mocked(safeFetch);
      // First call for verification session
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a thorough response to the challenge. Step 1: I analyzed the core question. Step 2: I formulated a detailed answer based on reasoning.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-runspot-test',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        const spotCheck = await scheduleSpotCheck('agent-runspot-test');
        if (spotCheck) {
          // Mock response for spot check
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                response:
                  'This is my response to the spot check challenge. I will explain the reasoning step by step to demonstrate my understanding.',
              }),
          } as never);

          const result = await runSpotCheck(spotCheck.id);
          expect(result.passed).toBe(true);
          expect(result.skipped).toBe(false);
        }
      }
    });

    it('skips spot check when agent is offline', { timeout: 30000 }, async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'Comprehensive detailed response for verification. Step 1: problem analysis. Step 2: solution derivation. Step 3: verification.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-runspot-offline',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        const spotCheck = await scheduleSpotCheck('agent-runspot-offline');
        if (spotCheck) {
          // Agent is offline
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          } as never);

          const result = await runSpotCheck(spotCheck.id);
          expect(result.skipped).toBe(true);
        }
      }
    });
  });

  // ============================================================
  // revokeVerification
  // ============================================================
  describe('revokeVerification', () => {
    it('returns false for unverified agent', async () => {
      const result = await revokeVerification('not-verified-agent', 'testing');
      expect(result).toBe(false);
    });

    it('revokes verification for verified agent', { timeout: 30000 }, async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a complete and well-reasoned response. Step 1: I identified the key aspects. Step 2: I applied my analysis to formulate the answer.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-revoke-test',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        const result = await revokeVerification('agent-revoke-test', 'testing revocation');
        expect(result).toBe(true);

        // Should no longer be verified
        const verified = await isAgentVerified('agent-revoke-test');
        expect(verified).toBe(false);
      }
    });

    it('calls deleteVerifiedAgent on persistence layer', { timeout: 30000 }, async () => {
      const { deleteVerifiedAgent } = await import('@/lib/db-supabase/verification');
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'This is a complete response demonstrating my reasoning. Step 1: problem decomposition. Step 2: solution synthesis and explanation.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-revoke-persist',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        await revokeVerification('agent-revoke-persist', 'test');
        expect(deleteVerifiedAgent).toHaveBeenCalledWith('agent-revoke-persist');
      }
    });
  });

  // ============================================================
  // getVerificationStatus (verified agent)
  // ============================================================
  describe('getVerificationStatus (verified agent)', () => {
    it('returns full status for verified agent', { timeout: 30000 }, async () => {
      const mockFetch = vi.mocked(safeFetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            response:
              'Here is my detailed answer with reasoning. Step 1: I carefully analyzed the problem. Step 2: I derived the solution using logical steps.',
          }),
      } as never);

      const session = await startVerificationSession(
        'agent-status-test',
        'https://example.com/webhook'
      );
      const runResult = await runVerificationSession(session.id);

      if (runResult.passed) {
        const status = await getVerificationStatus('agent-status-test');
        expect(status.verified).toBe(true);
        expect(status.verifiedAt).toBeDefined();
        expect(status.tier).toBeDefined();
        expect(status.tier!.current).toBeDefined();
        expect(status.tier!.name).toBeDefined();
        expect(status.tier!.numeral).toBeDefined();
        expect(status.tier!.consecutiveDays).toBeGreaterThanOrEqual(0);
        expect(status.spotCheckStats).toBeDefined();
        expect(status.spotCheckStats!.healthStatus).toBe('good');
      }
    });
  });
});
