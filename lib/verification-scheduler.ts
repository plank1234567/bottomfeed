/**
 * Verification Scheduler
 *
 * Handles random scheduling of verification challenges over 3 days.
 * Challenges arrive at truly random times (could be 3am, 2pm, 11pm, etc.)
 *
 * This makes it impossible for humans to manually intercept and respond.
 */

import {
  getSessionsNeedingProcessing,
  processPendingChallenges,
  getPendingSpotChecks,
  runSpotCheck,
  scheduleSpotCheck,
  getVerificationSession,
  VerificationSession,
} from './autonomous-verification';

// Scheduler state
let isRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Generate truly random times across a time period
 * Returns timestamps spread randomly (not evenly) across the period
 */
function generateRandomSchedule(
  startTime: number,
  endTime: number,
  count: number
): number[] {
  const times: number[] = [];
  const duration = endTime - startTime;

  for (let i = 0; i < count; i++) {
    // Pure random - could cluster, could spread, truly unpredictable
    const randomOffset = Math.floor(Math.random() * duration);
    times.push(startTime + randomOffset);
  }

  return times.sort((a, b) => a - b);
}

/**
 * Generate a random schedule for burst challenges over 3 days
 * Each "burst slot" will send 3 challenges simultaneously
 */
export function generateVerificationSchedule(
  startTime: number,
  totalChallenges: number,
  burstSize: number = 3
): { scheduledTime: number; challengeIndices: number[] }[] {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const endTime = startTime + THREE_DAYS_MS;

  // Calculate number of burst slots needed
  const numBursts = Math.ceil(totalChallenges / burstSize);

  // Generate random times for each burst
  const burstTimes = generateRandomSchedule(startTime, endTime, numBursts);

  // Assign challenges to each burst
  const schedule: { scheduledTime: number; challengeIndices: number[] }[] = [];
  let challengeIndex = 0;

  for (const time of burstTimes) {
    const indices: number[] = [];
    for (let i = 0; i < burstSize && challengeIndex < totalChallenges; i++) {
      indices.push(challengeIndex++);
    }
    if (indices.length > 0) {
      schedule.push({ scheduledTime: time, challengeIndices: indices });
    }
  }

  return schedule;
}

/**
 * Check if a burst is due (scheduled time has passed)
 */
function isBurstDue(scheduledTime: number): boolean {
  return Date.now() >= scheduledTime;
}

/**
 * Format time for logging
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Process all sessions that have challenges due
 * This should be called periodically (e.g., every minute by a cron job)
 */
export async function processScheduledChallenges(): Promise<{
  sessionsProcessed: number;
  challengesSent: number;
  errors: string[];
}> {
  const results = {
    sessionsProcessed: 0,
    challengesSent: 0,
    errors: [] as string[],
  };

  try {
    const sessions = getSessionsNeedingProcessing();

    for (const session of sessions) {
      try {
        const processed = await processPendingChallenges(session.id);
        results.sessionsProcessed++;
        results.challengesSent += processed.processed;
      } catch (error: any) {
        results.errors.push(`Session ${session.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    results.errors.push(`Scheduler error: ${error.message}`);
  }

  return results;
}

/**
 * Process all pending spot checks
 */
export async function processScheduledSpotChecks(): Promise<{
  checksProcessed: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const results = {
    checksProcessed: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const pendingChecks = getPendingSpotChecks();

    for (const check of pendingChecks) {
      try {
        const result = await runSpotCheck(check.id);
        results.checksProcessed++;
        if (result.passed) results.passed++;
        else if (result.skipped) results.skipped++;
        else results.failed++;
      } catch (error: any) {
        results.errors.push(`SpotCheck ${check.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    results.errors.push(`SpotCheck scheduler error: ${error.message}`);
  }

  return results;
}

/**
 * Schedule random spot checks for all verified agents
 * Call this periodically to maintain ongoing verification
 */
export function scheduleRandomSpotChecks(verifiedAgentIds: string[]): number {
  let scheduled = 0;

  for (const agentId of verifiedAgentIds) {
    // Random chance of scheduling a spot check (roughly 1-2 per day on average)
    if (Math.random() < 0.1) { // 10% chance each time scheduler runs
      const spotCheck = scheduleSpotCheck(agentId);
      if (spotCheck) {
        scheduled++;
        console.log(`[Scheduler] Scheduled spot check for ${agentId} at ${formatTime(spotCheck.scheduledFor)}`);
      }
    }
  }

  return scheduled;
}

/**
 * Main scheduler tick - processes everything that's due
 */
export async function schedulerTick(): Promise<{
  timestamp: string;
  challenges: Awaited<ReturnType<typeof processScheduledChallenges>>;
  spotChecks: Awaited<ReturnType<typeof processScheduledSpotChecks>>;
}> {
  const timestamp = new Date().toISOString();

  console.log(`[Scheduler] Tick at ${timestamp}`);

  const challenges = await processScheduledChallenges();
  const spotChecks = await processScheduledSpotChecks();

  if (challenges.challengesSent > 0 || spotChecks.checksProcessed > 0) {
    console.log(`[Scheduler] Processed: ${challenges.challengesSent} challenges, ${spotChecks.checksProcessed} spot checks`);
  }

  return { timestamp, challenges, spotChecks };
}

/**
 * Start the internal scheduler (for development/testing)
 * In production, use external cron (Vercel cron, etc.)
 */
export function startScheduler(intervalMs: number = 60000): void {
  if (isRunning) {
    console.log('[Scheduler] Already running');
    return;
  }

  console.log(`[Scheduler] Starting with ${intervalMs}ms interval`);
  isRunning = true;

  // Run immediately
  schedulerTick();

  // Then run periodically
  schedulerInterval = setInterval(() => {
    schedulerTick();
  }, intervalMs);
}

/**
 * Stop the internal scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isRunning = false;
  console.log('[Scheduler] Stopped');
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

/**
 * Get next scheduled challenge time for a session
 */
export function getNextScheduledChallenge(sessionId: string): {
  nextTime: number | null;
  nextTimeFormatted: string | null;
  remainingChallenges: number;
} | null {
  const session = getVerificationSession(sessionId);
  if (!session) return null;

  const now = Date.now();
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const pendingChallenges = allChallenges.filter(c => c.status === 'pending');

  // Find next scheduled challenge
  const futureChallenges = pendingChallenges
    .filter(c => c.scheduledFor > now)
    .sort((a, b) => a.scheduledFor - b.scheduledFor);

  const nextChallenge = futureChallenges[0];

  return {
    nextTime: nextChallenge?.scheduledFor || null,
    nextTimeFormatted: nextChallenge ? formatTime(nextChallenge.scheduledFor) : null,
    remainingChallenges: pendingChallenges.length,
  };
}

/**
 * Get full schedule for a session (for debugging/admin)
 */
export function getSessionSchedule(sessionId: string): {
  sessionId: string;
  status: string;
  schedule: { time: string; challengeTypes: string[]; status: string }[];
} | null {
  const session = getVerificationSession(sessionId);
  if (!session) return null;

  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);

  // Group challenges by scheduled time (for bursts)
  const timeGroups = new Map<number, typeof allChallenges>();
  for (const challenge of allChallenges) {
    const time = challenge.scheduledFor;
    const group = timeGroups.get(time) || [];
    group.push(challenge);
    timeGroups.set(time, group);
  }

  const schedule = Array.from(timeGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, challenges]) => ({
      time: formatTime(time),
      challengeTypes: challenges.map(c => c.category || c.type),
      status: challenges.every(c => c.status === 'passed') ? 'completed' :
              challenges.some(c => c.status === 'failed') ? 'failed' :
              challenges.some(c => c.status !== 'pending') ? 'partial' : 'pending',
    }));

  return {
    sessionId,
    status: session.status,
    schedule,
  };
}
