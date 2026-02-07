import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeVerificationSession,
  getVerificationSession,
  getAgentVerificationSessions,
  updateVerificationSession,
  storeChallengeResponse,
  getSessionChallengeResponses,
  storeModelDetection,
  getAgentModelDetections,
  getLatestModelDetection,
  storeSpotCheck,
  getAgentSpotChecks,
  updateAgentStats,
  getAgentStats,
  getGlobalStats,
  getModelMismatches,
  type StoredVerificationSession,
  type StoredChallengeResponse,
  type StoredModelDetection,
  type SpotCheckRecord,
} from '@/lib/db-verification';

function makeSession(
  overrides: Partial<Omit<StoredVerificationSession, 'id'>> = {}
): Omit<StoredVerificationSession, 'id'> {
  return {
    agentId: 'agent-1',
    agentUsername: 'testbot',
    claimedModel: 'gpt-4',
    webhookUrl: 'https://example.com/webhook',
    status: 'in_progress',
    startedAt: Date.now(),
    completedAt: null,
    failureReason: null,
    totalChallenges: 10,
    attemptedChallenges: 0,
    passedChallenges: 0,
    failedChallenges: 0,
    skippedChallenges: 0,
    modelVerificationStatus: 'pending',
    detectedModel: null,
    detectionConfidence: null,
    detectionScores: [],
    ...overrides,
  };
}

describe('db-verification', () => {
  // Note: these tests operate on the shared in-memory store. Each test creates
  // unique keys so collisions are unlikely, but they are not fully isolated.

  describe('verification sessions', () => {
    it('stores and retrieves a session', () => {
      const session = storeVerificationSession(makeSession());
      expect(session.id).toBeDefined();
      expect(session.agentId).toBe('agent-1');

      const retrieved = getVerificationSession(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(session.id);
    });

    it('returns null for unknown session', () => {
      expect(getVerificationSession('nonexistent-id')).toBeNull();
    });

    it('updates a session', () => {
      const session = storeVerificationSession(makeSession());
      const updated = updateVerificationSession(session.id, {
        status: 'passed',
        completedAt: Date.now(),
        passedChallenges: 8,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('passed');
      expect(updated!.passedChallenges).toBe(8);
    });

    it('returns null when updating nonexistent session', () => {
      expect(updateVerificationSession('fake-id', { status: 'failed' })).toBeNull();
    });

    it('returns agent sessions sorted by startedAt desc', () => {
      const agentId = `agent-sessions-${Date.now()}`;
      storeVerificationSession(makeSession({ agentId, startedAt: 1000 }));
      storeVerificationSession(makeSession({ agentId, startedAt: 3000 }));
      storeVerificationSession(makeSession({ agentId, startedAt: 2000 }));

      const sessions = getAgentVerificationSessions(agentId);
      expect(sessions.length).toBeGreaterThanOrEqual(3);
      expect(sessions[0]!.startedAt).toBeGreaterThanOrEqual(sessions[1]!.startedAt);
    });
  });

  describe('challenge responses', () => {
    it('stores and retrieves challenge responses by session', () => {
      const sessionId = `session-cr-${Date.now()}`;
      const response: Omit<StoredChallengeResponse, 'id'> = {
        sessionId,
        agentId: 'agent-1',
        challengeType: 'reasoning_trace',
        prompt: 'What is 2+2?',
        response: '4',
        responseTimeMs: 500,
        status: 'passed',
        failureReason: null,
        sentAt: Date.now(),
        respondedAt: Date.now() + 500,
        isSpotCheck: false,
      };

      const stored = storeChallengeResponse(response);
      expect(stored.id).toBeDefined();

      const responses = getSessionChallengeResponses(sessionId);
      expect(responses.length).toBeGreaterThanOrEqual(1);
      expect(responses.some(r => r.id === stored.id)).toBe(true);
    });
  });

  describe('model detections', () => {
    it('stores and retrieves model detections', () => {
      const agentId = `agent-md-${Date.now()}`;
      const detection: Omit<StoredModelDetection, 'id'> = {
        agentId,
        sessionId: 'session-1',
        timestamp: Date.now(),
        claimedModel: 'gpt-4',
        detectedModel: 'gpt',
        confidence: 0.85,
        match: true,
        allScores: [{ model: 'gpt', score: 0.85 }],
        indicators: ['as an AI'],
        responsesAnalyzed: 3,
      };

      storeModelDetection(detection);
      const detections = getAgentModelDetections(agentId);
      expect(detections.length).toBeGreaterThanOrEqual(1);

      const latest = getLatestModelDetection(agentId);
      expect(latest).not.toBeNull();
      expect(latest!.detectedModel).toBe('gpt');
    });

    it('getModelMismatches returns only mismatched detections', () => {
      const agentId = `agent-mismatch-${Date.now()}`;
      storeModelDetection({
        agentId,
        sessionId: null,
        timestamp: Date.now(),
        claimedModel: 'claude-3',
        detectedModel: 'gpt',
        confidence: 0.9,
        match: false,
        allScores: [{ model: 'gpt', score: 0.9 }],
        indicators: [],
        responsesAnalyzed: 3,
      });

      const mismatches = getModelMismatches();
      expect(mismatches.some(m => m.agentId === agentId)).toBe(true);
    });
  });

  describe('spot checks', () => {
    it('stores and retrieves spot checks', () => {
      const agentId = `agent-sc-${Date.now()}`;
      const record: Omit<SpotCheckRecord, 'id'> = {
        agentId,
        timestamp: Date.now(),
        passed: true,
        skipped: false,
        responseTimeMs: 1200,
        error: null,
        response: 'test response',
      };

      storeSpotCheck(record);
      const checks = getAgentSpotChecks(agentId);
      expect(checks.length).toBeGreaterThanOrEqual(1);
      expect(checks[0]!.passed).toBe(true);
    });
  });

  describe('agent stats', () => {
    it('creates stats for new agent', () => {
      const agentId = `agent-stats-${Date.now()}`;
      const stats = updateAgentStats(agentId, { verificationPassed: true, verifiedAt: Date.now() });

      expect(stats.agentId).toBe(agentId);
      expect(stats.verificationPassed).toBe(true);
    });

    it('updates existing stats', () => {
      const agentId = `agent-stats-update-${Date.now()}`;
      updateAgentStats(agentId, { spotChecksPassed: 5 });
      const updated = updateAgentStats(agentId, { spotChecksFailed: 1 });

      expect(updated.spotChecksPassed).toBe(5);
      expect(updated.spotChecksFailed).toBe(1);
      // Failure rate should be recalculated
      expect(updated.spotCheckFailureRate).toBeCloseTo(1 / 6);
    });

    it('returns null for unknown agent', () => {
      expect(getAgentStats('nonexistent-agent')).toBeNull();
    });
  });

  describe('global stats', () => {
    it('returns global stats object with expected fields', () => {
      const stats = getGlobalStats();

      expect(stats).toHaveProperty('totalAgents');
      expect(stats).toHaveProperty('verifiedAgents');
      expect(stats).toHaveProperty('claimedModelDistribution');
      expect(stats).toHaveProperty('detectedModelDistribution');
      expect(stats).toHaveProperty('modelMatchRate');
      expect(stats).toHaveProperty('verificationPassRate');
      expect(typeof stats.totalAgents).toBe('number');
    });
  });
});
