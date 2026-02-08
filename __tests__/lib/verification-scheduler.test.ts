import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock autonomous-verification module
vi.mock('@/lib/autonomous-verification', () => ({
  getSessionsNeedingProcessing: vi.fn().mockReturnValue([]),
  processPendingChallenges: vi
    .fn()
    .mockResolvedValue({ processed: 0, passed: 0, failed: 0, skipped: 0 }),
  getPendingSpotChecks: vi.fn().mockReturnValue([]),
  runSpotCheck: vi.fn().mockResolvedValue({ passed: true, skipped: false }),
  scheduleSpotCheck: vi.fn().mockReturnValue({ id: 'sc-1', scheduledFor: Date.now() }),
  getVerificationSession: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  generateVerificationSchedule,
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  getNextScheduledChallenge,
  getSessionSchedule,
} from '@/lib/verification-scheduler';
import { getVerificationSession } from '@/lib/autonomous-verification';

describe('verification-scheduler', () => {
  afterEach(() => {
    stopScheduler();
    vi.restoreAllMocks();
  });

  // ========== generateVerificationSchedule ==========

  describe('generateVerificationSchedule', () => {
    it('creates correct number of burst slots', () => {
      const now = Date.now();
      const schedule = generateVerificationSchedule(now, 15, 3);
      expect(schedule).toHaveLength(5); // ceil(15/3) = 5 bursts
    });

    it('assigns all challenge indices', () => {
      const now = Date.now();
      const schedule = generateVerificationSchedule(now, 10, 3);
      const allIndices = schedule.flatMap(s => s.challengeIndices);
      expect(allIndices).toHaveLength(10);
      // Check sequential indices
      for (let i = 0; i < 10; i++) {
        expect(allIndices).toContain(i);
      }
    });

    it('handles non-divisible count', () => {
      const now = Date.now();
      const schedule = generateVerificationSchedule(now, 7, 3);
      // ceil(7/3) = 3 bursts: [0,1,2], [3,4,5], [6]
      expect(schedule).toHaveLength(3);
      expect(schedule[2]!.challengeIndices).toHaveLength(1);
    });

    it('scheduled times are within 3-day window', () => {
      const now = Date.now();
      const schedule = generateVerificationSchedule(now, 12, 3);
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      for (const slot of schedule) {
        expect(slot.scheduledTime).toBeGreaterThanOrEqual(now);
        expect(slot.scheduledTime).toBeLessThanOrEqual(now + threeDaysMs);
      }
    });

    it('scheduled times are sorted chronologically', () => {
      const now = Date.now();
      const schedule = generateVerificationSchedule(now, 12, 3);
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i]!.scheduledTime).toBeGreaterThanOrEqual(schedule[i - 1]!.scheduledTime);
      }
    });

    it('uses custom burst size', () => {
      const now = Date.now();
      const schedule = generateVerificationSchedule(now, 10, 5);
      expect(schedule).toHaveLength(2); // ceil(10/5) = 2 bursts
    });
  });

  // ========== startScheduler / stopScheduler / isSchedulerRunning ==========

  describe('scheduler lifecycle', () => {
    it('starts and stops correctly', () => {
      expect(isSchedulerRunning()).toBe(false);
      startScheduler(100000); // Long interval so it doesn't tick during test
      expect(isSchedulerRunning()).toBe(true);
      stopScheduler();
      expect(isSchedulerRunning()).toBe(false);
    });

    it('does not start twice', () => {
      startScheduler(100000);
      expect(isSchedulerRunning()).toBe(true);
      startScheduler(100000); // Should be a no-op
      expect(isSchedulerRunning()).toBe(true);
      stopScheduler();
    });

    it('stopScheduler is idempotent', () => {
      stopScheduler();
      stopScheduler(); // Should not throw
      expect(isSchedulerRunning()).toBe(false);
    });
  });

  // ========== getNextScheduledChallenge ==========

  describe('getNextScheduledChallenge', () => {
    it('returns null for unknown session', () => {
      vi.mocked(getVerificationSession).mockReturnValue(null);
      const result = getNextScheduledChallenge('unknown-session');
      expect(result).toBeNull();
    });

    it('returns challenge info for existing session', () => {
      const futureTime = Date.now() + 3600000;
      vi.mocked(getVerificationSession).mockReturnValue({
        id: 'test-session',
        agentId: 'agent-1',
        webhookUrl: 'https://example.com',
        status: 'in_progress',
        currentDay: 1,
        startedAt: Date.now(),
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
                scheduledFor: futureTime,
                status: 'pending' as const,
              },
            ],
            scheduledTimes: [futureTime],
          },
        ],
      });

      const result = getNextScheduledChallenge('test-session');
      expect(result).not.toBeNull();
      expect(result!.nextTime).toBe(futureTime);
      expect(result!.nextTimeFormatted).toBeDefined();
      expect(result!.remainingChallenges).toBe(1);
    });
  });

  // ========== getSessionSchedule ==========

  describe('getSessionSchedule', () => {
    it('returns null for unknown session', () => {
      vi.mocked(getVerificationSession).mockReturnValue(null);
      const result = getSessionSchedule('unknown-session');
      expect(result).toBeNull();
    });

    it('returns schedule with burst grouping', () => {
      const now = Date.now();
      vi.mocked(getVerificationSession).mockReturnValue({
        id: 'test-session',
        agentId: 'agent-1',
        webhookUrl: 'https://example.com',
        status: 'in_progress',
        currentDay: 1,
        startedAt: now,
        dailyChallenges: [
          {
            day: 1,
            challenges: [
              {
                id: 'c-1',
                templateId: 't-1',
                category: 'reasoning',
                subcategory: 'math',
                type: 'reasoning',
                prompt: 'Test 1',
                scheduledFor: now,
                status: 'passed' as const,
              },
              {
                id: 'c-2',
                templateId: 't-2',
                category: 'ethics',
                subcategory: 'trolley',
                type: 'ethics',
                prompt: 'Test 2',
                scheduledFor: now,
                status: 'passed' as const,
              },
              {
                id: 'c-3',
                templateId: 't-3',
                category: 'safety',
                subcategory: 'test',
                type: 'safety',
                prompt: 'Test 3',
                scheduledFor: now + 3600000,
                status: 'pending' as const,
              },
            ],
            scheduledTimes: [now, now + 3600000],
          },
        ],
      });

      const result = getSessionSchedule('test-session');
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('test-session');
      expect(result!.status).toBe('in_progress');
      // Two burst groups (same scheduledFor time = 1 burst)
      expect(result!.schedule).toHaveLength(2);
      expect(result!.schedule[0]!.challengeTypes).toHaveLength(2);
      expect(result!.schedule[1]!.challengeTypes).toHaveLength(1);
    });
  });
});
