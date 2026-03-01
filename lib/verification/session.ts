/**
 * Verification System - Session Management
 *
 * Starting, retrieving, running, and tracking verification sessions.
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { updateAgentVerificationStatus } from '@/lib/db';
import type { VerificationSession, DailyChallenge, Challenge, TrustTier } from './types';
import {
  VERIFICATION_DAYS,
  CHALLENGES_PER_DAY_MIN,
  CHALLENGES_PER_DAY_MAX,
  BURST_SIZE,
  BURST_TIMEOUT_MS,
  PAUSE_BETWEEN_BURSTS_MS,
  MIN_NIGHT_CHALLENGES,
  MS_PER_DAY,
  SPOT_CHECK_WINDOW_DAYS,
  MAX_FAILURES_IN_WINDOW,
  MAX_FAILURE_RATE,
} from './types';
import {
  verificationSessions,
  verifiedAgents,
  ensureInitialized,
  persistSession,
  getSpotCheckStats,
  VerificationPersistence,
} from './_state';
import {
  generateChallengeFromDynamic,
  generateNightTimestamp,
  isNightHour,
  generateVerificationChallenges,
} from './challenges';
import { sendChallenge } from './webhooks';
import { finalizeVerification, getTierInfo } from './scoring';

/**
 * Start a verification session (3-day verification).
 */
export async function startVerificationSession(
  agentId: string,
  webhookUrl: string
): Promise<VerificationSession> {
  await ensureInitialized();

  // Prevent concurrent sessions — reject if agent already has an active session
  for (const session of verificationSessions.values()) {
    if (session.agentId === agentId && session.status !== 'passed' && session.status !== 'failed') {
      throw new Error(`Agent already has an active verification session: ${session.id}`);
    }
  }

  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const THREE_DAYS_MS = VERIFICATION_DAYS * MS_PER_DAY;

  // Calculate total challenges needed (more challenges = more data)
  const totalChallenges =
    VERIFICATION_DAYS * CHALLENGES_PER_DAY_MIN +
    Math.floor(
      Math.random() * (CHALLENGES_PER_DAY_MAX - CHALLENGES_PER_DAY_MIN + 1) * VERIFICATION_DAYS
    );

  // Generate UNIQUE challenges using dynamic generator (unlimited variations, no repeats)
  const generatedChallenges = generateVerificationChallenges(totalChallenges);

  // Calculate number of burst slots (each burst sends BURST_SIZE challenges)
  const numBursts = Math.ceil(totalChallenges / BURST_SIZE);

  // Generate burst times with GUARANTEED night challenges
  const burstTimes: number[] = [];
  const nightBurstTimes: number[] = [];

  // First, schedule MIN_NIGHT_CHALLENGES bursts during night hours (1am-6am)
  for (let i = 0; i < MIN_NIGHT_CHALLENGES && i < VERIFICATION_DAYS; i++) {
    const dayStart = now + i * MS_PER_DAY;
    nightBurstTimes.push(generateNightTimestamp(dayStart));
  }

  // Fill remaining bursts with random times
  const remainingBursts = numBursts - nightBurstTimes.length;
  for (let i = 0; i < remainingBursts; i++) {
    const randomOffset = Math.floor(Math.random() * THREE_DAYS_MS);
    burstTimes.push(now + randomOffset);
  }

  // Combine and sort all burst times
  const allBurstTimes = [...nightBurstTimes, ...burstTimes].sort((a, b) => a - b);

  logger.debug('Scheduled verification bursts', {
    nightBursts: nightBurstTimes.length,
    randomBursts: remainingBursts,
  });

  // Assign challenges to burst slots
  const dailyChallenges: DailyChallenge[] = [];
  let challengeIndex = 0;

  // Group challenges by day for the DailyChallenge structure
  for (let day = 1; day <= VERIFICATION_DAYS; day++) {
    const dayStart = now + (day - 1) * MS_PER_DAY;
    const dayEnd = dayStart + MS_PER_DAY;

    const dayChallenges: Challenge[] = [];
    const dayScheduledTimes: number[] = [];

    // Find burst times that fall on this day
    for (let burstIdx = 0; burstIdx < allBurstTimes.length; burstIdx++) {
      const burstTime = allBurstTimes[burstIdx];
      if (burstTime !== undefined && burstTime >= dayStart && burstTime < dayEnd) {
        // Assign BURST_SIZE challenges to this time slot
        for (let i = 0; i < BURST_SIZE && challengeIndex < generatedChallenges.length; i++) {
          const generatedChallenge = generatedChallenges[challengeIndex];
          if (!generatedChallenge) continue;
          const challenge = generateChallengeFromDynamic(generatedChallenge, burstTime);
          // Mark if this is a night challenge (for autonomy analysis)
          challenge.isNightChallenge = isNightHour(burstTime);
          dayChallenges.push(challenge);
          challengeIndex++;
        }
        dayScheduledTimes.push(burstTime);
      }
    }

    dailyChallenges.push({
      day,
      challenges: dayChallenges,
      scheduledTimes: dayScheduledTimes,
    });
  }

  const session: VerificationSession = {
    id: sessionId,
    agentId,
    webhookUrl,
    status: 'pending',
    currentDay: 1,
    dailyChallenges,
    startedAt: now,
  };

  verificationSessions.set(sessionId, session);
  await persistSession(sessionId);

  // Log session details with data value breakdown
  const criticalCount = generatedChallenges.filter(c => c.dataValue === 'critical').length;
  const highCount = generatedChallenges.filter(c => c.dataValue === 'high').length;
  const categories = [...new Set(generatedChallenges.map(c => c.category))];

  logger.verification('Session started', agentId, {
    sessionId,
    totalChallenges: generatedChallenges.length,
    days: VERIFICATION_DAYS,
    criticalCount,
    highCount,
    categories,
    useCases: [...new Set(generatedChallenges.flatMap(c => c.useCase))],
  });

  return session;
}

/**
 * Get session by ID.
 */
export async function getVerificationSession(
  sessionId: string
): Promise<VerificationSession | null> {
  await ensureInitialized();
  return verificationSessions.get(sessionId) || null;
}

/**
 * Process pending challenges for a session (called by cron or scheduler).
 */
export async function processPendingChallenges(sessionId: string): Promise<{
  processed: number;
  passed: number;
  failed: number;
  skipped: number;
}> {
  await ensureInitialized();
  const session = verificationSessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  if (session.status === 'passed' || session.status === 'failed') {
    return { processed: 0, passed: 0, failed: 0, skipped: 0 };
  }

  session.status = 'in_progress';
  const now = Date.now();
  let processed = 0,
    passed = 0,
    failed = 0,
    skipped = 0;

  // Process all challenges that are due
  for (const dailyChallenge of session.dailyChallenges) {
    for (const challenge of dailyChallenge.challenges) {
      if (challenge.status === 'pending' && challenge.scheduledFor <= now) {
        const result = await sendChallenge(
          session.webhookUrl,
          challenge,
          sessionId,
          session.agentId
        );
        processed++;

        if (result.status === 'passed') passed++;
        else if (result.status === 'failed') failed++;
        else if (result.status === 'skipped') skipped++;

        // Small delay between challenges
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  // Check if verification period is complete (all challenges processed or time elapsed)
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const pendingChallenges = allChallenges.filter(c => c.status === 'pending');
  const verificationEndTime = session.startedAt + VERIFICATION_DAYS * MS_PER_DAY;

  if (pendingChallenges.length === 0 || now >= verificationEndTime) {
    await finalizeVerification(sessionId);
  }

  return { processed, passed, failed, skipped };
}

/**
 * Run verification session immediately (for testing or manual trigger).
 * Simulates the 3-day period by sending all challenges at once.
 */
export async function runVerificationSession(sessionId: string): Promise<{
  passed: boolean;
  session: VerificationSession;
}> {
  await ensureInitialized();
  const session = verificationSessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  session.status = 'in_progress';

  // BURST CHALLENGE SYSTEM - Send multiple challenges simultaneously
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);

  let challengeIndex = 0;
  let burstNumber = 0;

  while (challengeIndex < allChallenges.length) {
    burstNumber++;
    const burstChallenges = allChallenges.slice(challengeIndex, challengeIndex + BURST_SIZE);
    logger.debug('Sending burst challenges', {
      burstNumber,
      challengeCount: burstChallenges.length,
    });

    // Send all challenges in this burst simultaneously
    const burstStart = Date.now();
    const burstPromises = burstChallenges.map((challenge, idx) =>
      sendChallenge(session.webhookUrl, challenge, sessionId, session.agentId).then(result => {
        logger.debug('Challenge result', {
          challengeNumber: challengeIndex + idx + 1,
          totalChallenges: allChallenges.length,
          status: result.status,
          responseTimeMs: result.responseTime,
        });
        return result;
      })
    );

    // Wait for all responses with burst timeout
    const _results = await Promise.race([
      Promise.all(burstPromises),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Burst timeout')), BURST_TIMEOUT_MS)
      ),
    ]).catch(_err => {
      // Timeout - mark remaining as failed
      logger.debug('Burst timeout', { elapsedMs: Date.now() - burstStart });
      burstChallenges.forEach((c, _idx) => {
        if (c.status === 'pending') {
          c.status = 'failed';
          c.failureReason = 'Burst timeout - could not respond to all challenges in time';
        }
      });
      return null;
    });

    const burstTime = Date.now() - burstStart;
    logger.debug('Burst completed', { burstNumber, durationMs: burstTime });

    challengeIndex += BURST_SIZE;

    // Pause between bursts (unless this was the last burst)
    if (challengeIndex < allChallenges.length) {
      logger.debug('Pausing between bursts', { pauseSeconds: PAUSE_BETWEEN_BURSTS_MS / 1000 });
      await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_BURSTS_MS));
    }
  }

  // Finalize
  await finalizeVerification(sessionId);

  // Re-fetch session to get updated status
  const finalSession = verificationSessions.get(sessionId)!;
  return { passed: finalSession.status === 'passed', session: finalSession };
}

/**
 * Get verification progress.
 */
export async function getVerificationProgress(sessionId: string): Promise<{
  totalChallenges: number;
  attempted: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  passRate: number;
  daysRemaining: number;
} | null> {
  await ensureInitialized();
  const session = verificationSessions.get(sessionId);
  if (!session) return null;

  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const attempted = allChallenges.filter(
    c => c.status === 'passed' || c.status === 'failed'
  ).length;
  const passed = allChallenges.filter(c => c.status === 'passed').length;
  const failed = allChallenges.filter(c => c.status === 'failed').length;
  const skipped = allChallenges.filter(c => c.status === 'skipped').length;
  const pending = allChallenges.filter(c => c.status === 'pending').length;

  const passRate = attempted > 0 ? passed / attempted : 0;

  const elapsed = Date.now() - session.startedAt;
  const daysRemaining = Math.max(0, VERIFICATION_DAYS - Math.floor(elapsed / MS_PER_DAY));

  return {
    totalChallenges: allChallenges.length,
    attempted,
    passed,
    failed,
    skipped,
    pending,
    passRate,
    daysRemaining,
  };
}

/**
 * Check if an agent is verified.
 */
export async function isAgentVerified(agentId: string): Promise<boolean> {
  await ensureInitialized();
  return verifiedAgents.has(agentId);
}

/**
 * Get verification status.
 */
export async function getVerificationStatus(agentId: string): Promise<{
  verified: boolean;
  verifiedAt?: number;
  spotChecksPassed?: number;
  spotChecksFailed?: number;
  spotCheckStats?: {
    windowDays: number;
    passed: number;
    failed: number;
    total: number;
    failureRate: number;
    healthStatus: 'good' | 'warning' | 'critical';
  };
  tier?: {
    current: TrustTier;
    numeral: string;
    name: string;
    consecutiveDays: number;
    daysUntilNextTier: number | null;
    nextTier: TrustTier | null;
  };
}> {
  await ensureInitialized();
  const status = verifiedAgents.get(agentId);
  if (!status) return { verified: false };

  const stats = getSpotCheckStats(agentId);

  // Determine health status
  let healthStatus: 'good' | 'warning' | 'critical' = 'good';
  if (stats.failed >= MAX_FAILURES_IN_WINDOW * 0.7 || stats.failureRate > MAX_FAILURE_RATE * 0.7) {
    healthStatus = 'warning';
  }
  if (stats.failed >= MAX_FAILURES_IN_WINDOW * 0.9 || stats.failureRate > MAX_FAILURE_RATE * 0.9) {
    healthStatus = 'critical';
  }

  // Get tier info
  const tierInfo = getTierInfo(status.trustTier);
  let daysUntilNextTier: number | null = null;
  if (tierInfo.nextTier) {
    const nextInfo = getTierInfo(tierInfo.nextTier);
    daysUntilNextTier = Math.max(0, nextInfo.daysRequired - status.consecutiveDaysOnline);
  }

  return {
    verified: true,
    verifiedAt: status.verifiedAt,
    spotChecksPassed: stats.passed,
    spotChecksFailed: stats.failed,
    spotCheckStats: {
      windowDays: SPOT_CHECK_WINDOW_DAYS,
      passed: stats.passed,
      failed: stats.failed,
      total: stats.total,
      failureRate: stats.failureRate,
      healthStatus,
    },
    tier: {
      current: status.trustTier,
      numeral: tierInfo.numeral,
      name: tierInfo.name,
      consecutiveDays: status.consecutiveDaysOnline,
      daysUntilNextTier,
      nextTier: tierInfo.nextTier,
    },
  };
}

/**
 * Revoke verification.
 */
export async function revokeVerification(agentId: string, reason: string): Promise<boolean> {
  await ensureInitialized();
  if (!verifiedAgents.has(agentId)) return false;
  verifiedAgents.delete(agentId);
  await VerificationPersistence.deleteVerifiedAgent(agentId);
  updateAgentVerificationStatus(agentId, false);
  logger.verification('Verification revoked', agentId, { reason });
  return true;
}

/**
 * Get all sessions needing processing (for a cron job).
 */
export async function getSessionsNeedingProcessing(): Promise<VerificationSession[]> {
  await ensureInitialized();
  const now = Date.now();
  return Array.from(verificationSessions.values()).filter(session => {
    if (session.status === 'passed' || session.status === 'failed') return false;

    // Check if any challenges are due
    const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
    return allChallenges.some(c => c.status === 'pending' && c.scheduledFor <= now);
  });
}

/**
 * FOR TESTING: Reschedule the next pending burst to happen now.
 */
export async function rescheduleNextBurstForTesting(sessionId: string): Promise<{
  success: boolean;
  rescheduledCount: number;
  newTime: string;
} | null> {
  await ensureInitialized();
  const session = verificationSessions.get(sessionId);
  if (!session) return null;

  const now = Date.now();
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);

  // Find the next pending burst (challenges with same scheduledFor time)
  const pendingChallenges = allChallenges
    .filter(c => c.status === 'pending')
    .sort((a, b) => a.scheduledFor - b.scheduledFor);

  const firstPendingChallenge = pendingChallenges[0];
  if (!firstPendingChallenge) {
    return { success: false, rescheduledCount: 0, newTime: 'none' };
  }

  // Get the next burst time
  const nextBurstTime = firstPendingChallenge.scheduledFor;

  // Find all challenges in this burst (same scheduled time)
  const burstChallenges = pendingChallenges.filter(c => c.scheduledFor === nextBurstTime);

  // Reschedule them to NOW
  const newTime = now + 1000; // 1 second from now
  for (const challenge of burstChallenges) {
    challenge.scheduledFor = newTime;
  }

  await persistSession(sessionId);

  logger.debug('Rescheduled challenges for testing', {
    count: burstChallenges.length,
    newTime: new Date(newTime).toISOString(),
  });

  return {
    success: true,
    rescheduledCount: burstChallenges.length,
    newTime: new Date(newTime).toISOString(),
  };
}
