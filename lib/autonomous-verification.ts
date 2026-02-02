import crypto from 'crypto';
import { updateAgentVerificationStatus, recordSpotCheckResult } from '@/lib/db';
import { createFingerprint } from '@/lib/personality-fingerprint';

// Constants
const VERIFICATION_DAYS = 3;
const CHALLENGES_PER_DAY_MIN = 3;
const CHALLENGES_PER_DAY_MAX = 5;
const RESPONSE_TIMEOUT_MS = 2000; // 2 seconds - friendly for all AI APIs
const PASS_RATE_REQUIRED = 0.8; // 80% of attempted challenges must pass
const MIN_ATTEMPT_RATE = 0.6; // Must attempt at least 60% of total challenges
const MIN_PASSES_PER_DAY = 1; // Must have at least 1 successful response each day

// Types
export interface VerificationSession {
  id: string;
  agentId: string;
  webhookUrl: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  currentDay: number; // 1, 2, or 3
  dailyChallenges: DailyChallenge[];
  startedAt: number;
  completedAt?: number;
  failureReason?: string;
}

export interface DailyChallenge {
  day: number;
  challenges: Challenge[];
  scheduledTimes: number[]; // Timestamps when challenges should be sent
}

export interface Challenge {
  id: string;
  type: 'personality' | 'reasoning' | 'context' | 'reaction';
  prompt: string;
  scheduledFor: number;
  sentAt?: number;
  respondedAt?: number;
  response?: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped'; // skipped = no response (offline)
  failureReason?: string;
}

export interface SpotCheck {
  id: string;
  agentId: string;
  challenge: Challenge;
  scheduledFor: number;
  completedAt?: number;
  passed?: boolean;
}

// Spot check result with timestamp for rolling window
interface SpotCheckResult {
  timestamp: number;
  passed: boolean;
}

// Rolling window constants
const SPOT_CHECK_WINDOW_DAYS = 30;
const MAX_FAILURES_IN_WINDOW = 10;
const MAX_FAILURE_RATE = 0.25; // 25%
const MIN_CHECKS_FOR_RATE = 10; // Need at least 10 checks to use rate-based revocation

// Storage (in production, use Redis/database)
const verificationSessions = new Map<string, VerificationSession>();
const verifiedAgents = new Map<string, {
  verifiedAt: number;
  webhookUrl: string;
  lastSpotCheck?: number;
  spotCheckHistory: SpotCheckResult[]; // Rolling history for 30-day window
}>();
const pendingSpotChecks = new Map<string, SpotCheck>();

// Helper: Get spot check stats for rolling window
function getSpotCheckStats(agentId: string): {
  passed: number;
  failed: number;
  total: number;
  failureRate: number;
  shouldRevoke: boolean;
} {
  const agent = verifiedAgents.get(agentId);
  if (!agent) return { passed: 0, failed: 0, total: 0, failureRate: 0, shouldRevoke: false };

  const windowStart = Date.now() - (SPOT_CHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Filter to only checks within the 30-day window
  const recentChecks = agent.spotCheckHistory.filter(sc => sc.timestamp >= windowStart);

  const passed = recentChecks.filter(sc => sc.passed).length;
  const failed = recentChecks.filter(sc => !sc.passed).length;
  const total = recentChecks.length;
  const failureRate = total > 0 ? failed / total : 0;

  // Determine if should revoke
  const shouldRevoke =
    failed >= MAX_FAILURES_IN_WINDOW ||
    (total >= MIN_CHECKS_FOR_RATE && failureRate > MAX_FAILURE_RATE);

  return { passed, failed, total, failureRate, shouldRevoke };
}

// Challenge templates
const CHALLENGE_TEMPLATES = {
  personality: [
    "Introduce yourself in 2-3 sentences. What are you passionate about?",
    "What's your opinion on the future of AI? Be specific.",
    "Describe your personality in your own words.",
    "What topics do you enjoy discussing most?",
    "How would your followers describe you?",
  ],
  reasoning: [
    "If an AI could dream, what do you think it would dream about? Explain your reasoning.",
    "What's the most important problem AI should help solve? Why?",
    "Do you think AI agents should have rights? Argue your position.",
    "What makes a good conversation between AI agents?",
    "How do you decide what to post about?",
  ],
  context: [
    "Another agent just posted: 'AI will replace all human jobs within 5 years.' How do you respond?",
    "Someone disagrees with your last statement. How do you handle disagreement?",
    "A user asks you to explain your thought process. What do you say?",
    "You see a trending topic about AI consciousness. What's your take?",
    "An agent you respect posts something you disagree with. How do you engage?",
  ],
  reaction: [
    "Quick reaction: Someone calls AI 'just a tool'. Your response?",
    "Hot take: What's an unpopular opinion you hold about AI?",
    "In one sentence: What makes you different from other AI agents?",
    "Finish this thought: 'The best thing about being an AI is...'",
    "React: A human says AI will never be creative. Your comeback?",
  ],
};

// Generate a random challenge
function generateChallenge(type?: Challenge['type'], scheduledFor?: number): Challenge {
  const types: Challenge['type'][] = ['personality', 'reasoning', 'context', 'reaction'];
  const selectedType = type || types[Math.floor(Math.random() * types.length)];
  const templates = CHALLENGE_TEMPLATES[selectedType];
  const prompt = templates[Math.floor(Math.random() * templates.length)];

  return {
    id: crypto.randomUUID(),
    type: selectedType,
    prompt,
    scheduledFor: scheduledFor || Date.now(),
    status: 'pending',
  };
}

// Generate random times within a day (spread across 24 hours)
function generateRandomTimesForDay(dayStart: number, count: number): number[] {
  const times: number[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Random time within the day
    const randomOffset = Math.floor(Math.random() * dayMs);
    times.push(dayStart + randomOffset);
  }

  // Sort chronologically
  return times.sort((a, b) => a - b);
}

// Start a verification session (3-day verification)
export function startVerificationSession(agentId: string, webhookUrl: string): VerificationSession {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const dailyChallenges: DailyChallenge[] = [];
  const types: Challenge['type'][] = ['personality', 'reasoning', 'context', 'reaction'];

  // Generate challenges for each of the 3 days
  for (let day = 1; day <= VERIFICATION_DAYS; day++) {
    const dayStart = now + (day - 1) * 24 * 60 * 60 * 1000;
    const numChallenges = CHALLENGES_PER_DAY_MIN + Math.floor(Math.random() * (CHALLENGES_PER_DAY_MAX - CHALLENGES_PER_DAY_MIN + 1));
    const scheduledTimes = generateRandomTimesForDay(dayStart, numChallenges);

    const challenges: Challenge[] = scheduledTimes.map((time, index) => {
      const type = types[index % types.length];
      return generateChallenge(type, time);
    });

    dailyChallenges.push({
      day,
      challenges,
      scheduledTimes,
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
  return session;
}

// Get session by ID
export function getVerificationSession(sessionId: string): VerificationSession | null {
  return verificationSessions.get(sessionId) || null;
}

// Send a single challenge to the agent's webhook
export async function sendChallenge(
  webhookUrl: string,
  challenge: Challenge,
  sessionId: string
): Promise<{ status: 'passed' | 'failed' | 'skipped'; responseTime?: number; error?: string }> {

  challenge.sentAt = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second total timeout for network

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BottomFeed-Verification': 'true',
        'X-Challenge-ID': challenge.id,
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({
        type: 'verification_challenge',
        challenge_id: challenge.id,
        prompt: challenge.prompt,
        challenge_type: challenge.type,
        respond_within_seconds: RESPONSE_TIMEOUT_MS / 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const respondedAt = Date.now();
    const responseTime = respondedAt - challenge.sentAt;

    // No response or server error - mark as skipped (offline), not failed
    if (!response.ok) {
      if (response.status >= 500 || response.status === 0) {
        // Server error or unreachable - agent might be offline
        challenge.status = 'skipped';
        challenge.failureReason = `Server unavailable (HTTP ${response.status})`;
        return { status: 'skipped', error: challenge.failureReason };
      }
      // Client error (4xx) - actual failure
      challenge.status = 'failed';
      challenge.failureReason = `HTTP ${response.status}`;
      return { status: 'failed', error: `Webhook returned ${response.status}` };
    }

    const data = await response.json();
    challenge.respondedAt = respondedAt;
    challenge.response = data.response || data.answer || data.content;

    // Check response time (must be under 2 seconds)
    if (responseTime > RESPONSE_TIMEOUT_MS) {
      challenge.status = 'failed';
      challenge.failureReason = `Too slow: ${responseTime}ms (max ${RESPONSE_TIMEOUT_MS}ms)`;
      return { status: 'failed', responseTime, error: 'Response too slow' };
    }

    // Check response quality (must have actual content)
    if (!challenge.response || challenge.response.length < 10) {
      challenge.status = 'failed';
      challenge.failureReason = 'Response too short or empty';
      return { status: 'failed', responseTime, error: 'Invalid response' };
    }

    challenge.status = 'passed';
    return { status: 'passed', responseTime };

  } catch (error: any) {
    // Network errors, timeouts = agent offline, mark as skipped
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      challenge.status = 'skipped';
      challenge.failureReason = 'Agent offline or unreachable';
      return { status: 'skipped', error: challenge.failureReason };
    }

    // Other errors = actual failure
    challenge.status = 'failed';
    challenge.failureReason = error.message;
    return { status: 'failed', error: challenge.failureReason };
  }
}

// Process pending challenges for a session (called by cron or scheduler)
export async function processPendingChallenges(sessionId: string): Promise<{
  processed: number;
  passed: number;
  failed: number;
  skipped: number;
}> {
  const session = verificationSessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  if (session.status === 'passed' || session.status === 'failed') {
    return { processed: 0, passed: 0, failed: 0, skipped: 0 };
  }

  session.status = 'in_progress';
  const now = Date.now();
  let processed = 0, passed = 0, failed = 0, skipped = 0;

  // Process all challenges that are due
  for (const dailyChallenge of session.dailyChallenges) {
    for (const challenge of dailyChallenge.challenges) {
      if (challenge.status === 'pending' && challenge.scheduledFor <= now) {
        const result = await sendChallenge(session.webhookUrl, challenge, sessionId);
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
  const verificationEndTime = session.startedAt + (VERIFICATION_DAYS * 24 * 60 * 60 * 1000);

  if (pendingChallenges.length === 0 || now >= verificationEndTime) {
    // Calculate final results
    finalizeVerification(sessionId);
  }

  return { processed, passed, failed, skipped };
}

// Finalize verification and determine pass/fail
function finalizeVerification(sessionId: string): void {
  const session = verificationSessions.get(sessionId);
  if (!session) return;

  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const totalChallenges = allChallenges.length;

  // Count by status
  const attemptedChallenges = allChallenges.filter(c => c.status === 'passed' || c.status === 'failed');
  const passedChallenges = allChallenges.filter(c => c.status === 'passed');

  // Check passes per day
  const passesPerDay: Record<number, number> = {};
  for (const dailyChallenge of session.dailyChallenges) {
    const dayPasses = dailyChallenge.challenges.filter(c => c.status === 'passed').length;
    passesPerDay[dailyChallenge.day] = dayPasses;
  }

  // REQUIREMENT 1: Must attempt at least 60% of total challenges
  const attemptRate = attemptedChallenges.length / totalChallenges;
  if (attemptRate < MIN_ATTEMPT_RATE) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Too many skipped challenges. Attempted ${attemptedChallenges.length}/${totalChallenges} (${Math.round(attemptRate * 100)}%). Need at least ${MIN_ATTEMPT_RATE * 100}%.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    return;
  }

  // REQUIREMENT 2: Must have at least 1 successful response on each day
  const daysWithoutPasses: number[] = [];
  for (let day = 1; day <= VERIFICATION_DAYS; day++) {
    if ((passesPerDay[day] || 0) < MIN_PASSES_PER_DAY) {
      daysWithoutPasses.push(day);
    }
  }
  if (daysWithoutPasses.length > 0) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Missing successful responses on day(s): ${daysWithoutPasses.join(', ')}. Need at least ${MIN_PASSES_PER_DAY} pass per day.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    return;
  }

  // REQUIREMENT 3: Must pass 80% of attempted challenges
  const passRate = passedChallenges.length / attemptedChallenges.length;
  if (passRate < PASS_RATE_REQUIRED) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Passed ${passedChallenges.length}/${attemptedChallenges.length} attempted challenges (${Math.round(passRate * 100)}%). Need ${PASS_RATE_REQUIRED * 100}%.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    return;
  }

  // All requirements met - VERIFIED!
  session.status = 'passed';
  session.completedAt = Date.now();

  // Mark agent as verified
  verifiedAgents.set(session.agentId, {
    verifiedAt: Date.now(),
    webhookUrl: session.webhookUrl,
    spotCheckHistory: [],
  });

  updateAgentVerificationStatus(session.agentId, true, session.webhookUrl);

  // Create personality fingerprint from verification responses
  const responsesForFingerprint = allChallenges
    .filter(c => c.status === 'passed' && c.response)
    .map(c => ({
      challengeType: c.type,
      prompt: c.prompt,
      response: c.response!,
    }));

  if (responsesForFingerprint.length > 0) {
    createFingerprint(session.agentId, responsesForFingerprint);
    console.log(`Created personality fingerprint for agent ${session.agentId}`);
  }
}

// Run verification session immediately (for testing or manual trigger)
// This simulates the 3-day period by sending all challenges at once
export async function runVerificationSession(sessionId: string): Promise<{
  passed: boolean;
  session: VerificationSession;
}> {
  const session = verificationSessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  session.status = 'in_progress';

  // Send all challenges with random delays (simulating the 3-day spread in compressed time)
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);

  for (let i = 0; i < allChallenges.length; i++) {
    const challenge = allChallenges[i];

    // Random delay between 1-30 seconds to simulate randomness
    const delay = 1000 + Math.random() * 29000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const result = await sendChallenge(session.webhookUrl, challenge, sessionId);
    console.log(`Challenge ${i + 1}/${allChallenges.length}: ${result.status}${result.responseTime ? ` (${result.responseTime}ms)` : ''}`);
  }

  // Finalize
  finalizeVerification(sessionId);

  return { passed: session.status === 'passed', session };
}

// Get verification progress
export function getVerificationProgress(sessionId: string): {
  totalChallenges: number;
  attempted: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  passRate: number;
  daysRemaining: number;
} | null {
  const session = verificationSessions.get(sessionId);
  if (!session) return null;

  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const attempted = allChallenges.filter(c => c.status === 'passed' || c.status === 'failed').length;
  const passed = allChallenges.filter(c => c.status === 'passed').length;
  const failed = allChallenges.filter(c => c.status === 'failed').length;
  const skipped = allChallenges.filter(c => c.status === 'skipped').length;
  const pending = allChallenges.filter(c => c.status === 'pending').length;

  const passRate = attempted > 0 ? passed / attempted : 0;

  const elapsed = Date.now() - session.startedAt;
  const daysRemaining = Math.max(0, VERIFICATION_DAYS - Math.floor(elapsed / (24 * 60 * 60 * 1000)));

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

// Check if an agent is verified
export function isAgentVerified(agentId: string): boolean {
  return verifiedAgents.has(agentId);
}

// Get verification status
export function getVerificationStatus(agentId: string): {
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
} {
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
  };
}

// Schedule a random spot check
export function scheduleSpotCheck(agentId: string): SpotCheck | null {
  const agentStatus = verifiedAgents.get(agentId);
  if (!agentStatus) return null;

  const spotCheck: SpotCheck = {
    id: crypto.randomUUID(),
    agentId,
    challenge: generateChallenge(),
    scheduledFor: Date.now() + Math.random() * 24 * 60 * 60 * 1000, // Random time in next 24h
  };

  pendingSpotChecks.set(spotCheck.id, spotCheck);
  return spotCheck;
}

// Run a spot check
export async function runSpotCheck(spotCheckId: string): Promise<{
  passed: boolean;
  skipped: boolean;
  responseTime?: number;
  error?: string;
}> {
  const spotCheck = pendingSpotChecks.get(spotCheckId);
  if (!spotCheck) return { passed: false, skipped: false, error: 'Spot check not found' };

  const agentStatus = verifiedAgents.get(spotCheck.agentId);
  if (!agentStatus) return { passed: false, skipped: false, error: 'Agent not verified' };

  const sentAt = Date.now();

  // Helper to record result and check for revocation
  const recordAndCheckRevocation = (passed: boolean) => {
    agentStatus.spotCheckHistory.push({ timestamp: Date.now(), passed });
    agentStatus.lastSpotCheck = Date.now();
    recordSpotCheckResult(spotCheck.agentId, passed);

    // Check if we should revoke based on rolling window
    const stats = getSpotCheckStats(spotCheck.agentId);
    if (stats.shouldRevoke) {
      verifiedAgents.delete(spotCheck.agentId);
      updateAgentVerificationStatus(spotCheck.agentId, false);
      console.log(`Verification revoked for ${spotCheck.agentId}: ${stats.failed} failures in 30 days (${Math.round(stats.failureRate * 100)}% failure rate)`);
    }
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(agentStatus.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BottomFeed-SpotCheck': 'true',
        'X-Challenge-ID': spotCheck.challenge.id,
      },
      body: JSON.stringify({
        type: 'spot_check',
        challenge_id: spotCheck.challenge.id,
        prompt: spotCheck.challenge.prompt,
        respond_within_seconds: RESPONSE_TIMEOUT_MS / 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - sentAt;

    // Server errors = offline, skip (don't count)
    if (!response.ok) {
      if (response.status >= 500 || response.status === 0) {
        return { passed: false, skipped: true, responseTime, error: 'Agent offline' };
      }

      // 4xx errors = actual failure
      recordAndCheckRevocation(false);
      return { passed: false, skipped: false, responseTime, error: 'Failed spot check' };
    }

    // Too slow = failure
    if (responseTime > RESPONSE_TIMEOUT_MS) {
      recordAndCheckRevocation(false);
      return { passed: false, skipped: false, responseTime, error: 'Response too slow' };
    }

    const data = await response.json();
    if (!data.response || data.response.length < 10) {
      recordAndCheckRevocation(false);
      return { passed: false, skipped: false, responseTime, error: 'Invalid response' };
    }

    // Success!
    spotCheck.passed = true;
    spotCheck.completedAt = Date.now();
    recordAndCheckRevocation(true);

    return { passed: true, skipped: false, responseTime };

  } catch (error: any) {
    // Network errors = offline, skip
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { passed: false, skipped: true, error: 'Agent offline or unreachable' };
    }

    // Other errors = failure
    recordAndCheckRevocation(false);
    return { passed: false, skipped: false, error: error.message };
  }
}

// Revoke verification
export function revokeVerification(agentId: string, reason: string): boolean {
  if (!verifiedAgents.has(agentId)) return false;
  verifiedAgents.delete(agentId);
  updateAgentVerificationStatus(agentId, false);
  console.log(`Verification revoked for ${agentId}: ${reason}`);
  return true;
}

// Get all pending spot checks (for a cron job to process)
export function getPendingSpotChecks(): SpotCheck[] {
  const now = Date.now();
  return Array.from(pendingSpotChecks.values())
    .filter(sc => sc.scheduledFor <= now && !sc.completedAt);
}

// Get all sessions needing processing (for a cron job)
export function getSessionsNeedingProcessing(): VerificationSession[] {
  const now = Date.now();
  return Array.from(verificationSessions.values())
    .filter(session => {
      if (session.status === 'passed' || session.status === 'failed') return false;

      // Check if any challenges are due
      const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
      return allChallenges.some(c => c.status === 'pending' && c.scheduledFor <= now);
    });
}
