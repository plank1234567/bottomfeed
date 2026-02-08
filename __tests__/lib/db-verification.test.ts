import { describe, it, expect, beforeEach } from 'vitest';
import {
  storeVerificationSession,
  getVerificationSession,
  getAgentVerificationSessions,
  getAllVerificationSessions,
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
  getAgentsByDetectedModel,
  getResponsesByModel,
  searchResponses,
  exportAllData,
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

  // QUERY HELPERS

  describe('getAgentsByDetectedModel', () => {
    it('returns agents matching the detected model (case-insensitive)', () => {
      const agentId = `agent-detected-model-${Date.now()}`;
      updateAgentStats(agentId, { detectedModel: 'claude' });

      const results = getAgentsByDetectedModel('Claude');
      expect(results.some(a => a.agentId === agentId)).toBe(true);
    });

    it('returns empty array for unknown model', () => {
      const results = getAgentsByDetectedModel('nonexistent-model-xyz-999');
      expect(results).toEqual([]);
    });
  });

  describe('getResponsesByModel', () => {
    it('returns responses from agents with the specified detected model', () => {
      const agentId = `agent-resp-model-${Date.now()}`;
      const sessionId = `session-resp-model-${Date.now()}`;
      updateAgentStats(agentId, { detectedModel: 'gemini' });
      storeChallengeResponse({
        sessionId,
        agentId,
        challengeType: 'reasoning_trace',
        prompt: 'Test prompt',
        response: 'Test response content',
        responseTimeMs: 300,
        status: 'passed',
        failureReason: null,
        sentAt: Date.now(),
        respondedAt: Date.now() + 300,
        isSpotCheck: false,
      });

      const results = getResponsesByModel('gemini');
      expect(results.some(r => r.agentId === agentId)).toBe(true);
    });

    it('excludes responses with null content', () => {
      const agentId = `agent-null-resp-${Date.now()}`;
      const sessionId = `session-null-resp-${Date.now()}`;
      updateAgentStats(agentId, { detectedModel: 'nulltest' });
      storeChallengeResponse({
        sessionId,
        agentId,
        challengeType: 'test',
        prompt: 'Test',
        response: null,
        responseTimeMs: null,
        status: 'skipped',
        failureReason: null,
        sentAt: Date.now(),
        respondedAt: null,
        isSpotCheck: false,
      });

      const results = getResponsesByModel('nulltest');
      expect(results.every(r => r.response !== null)).toBe(true);
    });
  });

  describe('searchResponses', () => {
    it('finds responses containing the search query (case-insensitive)', () => {
      const sessionId = `session-search-${Date.now()}`;
      const uniquePhrase = `unique-search-marker-${Date.now()}`;
      storeChallengeResponse({
        sessionId,
        agentId: 'search-agent',
        challengeType: 'test',
        prompt: 'Test prompt',
        response: `This response contains ${uniquePhrase} in it`,
        responseTimeMs: 200,
        status: 'passed',
        failureReason: null,
        sentAt: Date.now(),
        respondedAt: Date.now() + 200,
        isSpotCheck: false,
      });

      const results = searchResponses(uniquePhrase);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.response).toContain(uniquePhrase);
    });

    it('returns empty array when no match found', () => {
      const results = searchResponses('completely-impossible-string-xyz-999');
      expect(results).toEqual([]);
    });
  });

  describe('getAllVerificationSessions', () => {
    it('returns sessions sorted by startedAt desc', () => {
      const sessions = getAllVerificationSessions();
      for (let i = 1; i < sessions.length; i++) {
        expect(sessions[i - 1]!.startedAt).toBeGreaterThanOrEqual(sessions[i]!.startedAt);
      }
    });
  });

  describe('exportAllData', () => {
    it('returns all data collections', () => {
      const data = exportAllData();
      expect(data).toHaveProperty('sessions');
      expect(data).toHaveProperty('responses');
      expect(data).toHaveProperty('detections');
      expect(data).toHaveProperty('spotChecks');
      expect(data).toHaveProperty('agentStats');
      expect(data).toHaveProperty('globalStats');
      expect(Array.isArray(data.sessions)).toBe(true);
      expect(Array.isArray(data.responses)).toBe(true);
      expect(Array.isArray(data.detections)).toBe(true);
      expect(Array.isArray(data.spotChecks)).toBe(true);
      expect(Array.isArray(data.agentStats)).toBe(true);
      expect(typeof data.globalStats).toBe('object');
    });

    it('global stats within export match standalone call', () => {
      const exported = exportAllData();
      const standalone = getGlobalStats();
      expect(exported.globalStats.totalAgents).toBe(standalone.totalAgents);
    });
  });

  describe('getLatestModelDetection edge case', () => {
    it('returns null for agent with no detections', () => {
      const result = getLatestModelDetection(`no-detections-${Date.now()}`);
      expect(result).toBeNull();
    });
  });

  describe('getAgentSpotChecks edge case', () => {
    it('filters by date window', () => {
      const agentId = `agent-sc-window-${Date.now()}`;
      // Store a spot check with old timestamp
      storeSpotCheck({
        agentId,
        timestamp: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
        passed: true,
        skipped: false,
        responseTimeMs: 100,
        error: null,
        response: 'old',
      });

      // Default window is 30 days, so old check should be excluded
      const checks = getAgentSpotChecks(agentId, 30);
      expect(checks.every(c => c.response !== 'old' || c.agentId !== agentId)).toBe(true);
    });
  });
});
