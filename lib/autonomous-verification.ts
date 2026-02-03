import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { updateAgentVerificationStatus, recordSpotCheckResult, updateAgentDetectedModel, getAgentById, updateAgentTrustTier } from '@/lib/db';
import { createFingerprint } from '@/lib/personality-fingerprint';
import { detectModel, modelsMatch } from '@/lib/model-detection';
import * as VerificationDB from '@/lib/db-verification';
import {
  ChallengeTemplate,
  ChallengeCategory,
  getVerificationChallenges,
  getSpotCheckChallenge as getSpotCheckChallengeV1,
  parseResponse,
} from '@/lib/verification-challenges';
import {
  HighValueChallenge,
  DataCategory,
  getHighValueChallenges,
  getSpotCheckChallenge as getSpotCheckChallengeV2,
  parseHighValueResponse,
  HIGH_VALUE_CHALLENGES,
} from '@/lib/verification-challenges-v2';
import {
  GeneratedChallenge,
  generateVerificationChallenges,
  generateSpotCheckChallenge as generateDynamicSpotCheck,
} from '@/lib/challenge-generator';

// Constants
const VERIFICATION_DAYS = 3;
const CHALLENGES_PER_DAY_MIN = 3;
const CHALLENGES_PER_DAY_MAX = 5;
const RESPONSE_TIMEOUT_MS = 15000; // 15 seconds per challenge - enough for most AI APIs
const PASS_RATE_REQUIRED = 0.8; // 80% of attempted challenges must pass
const MIN_ATTEMPT_RATE = 0.6; // Must attempt at least 60% of total challenges
const MIN_PASSES_PER_DAY = 1; // Must have at least 1 successful response each day

// Burst challenge settings (anti-human-gaming)
const BURST_SIZE = 3; // Send 3 challenges simultaneously
const BURST_TIMEOUT_MS = 20000; // 20 seconds to answer ALL 3 challenges - AI can parallelize, humans can't
const PAUSE_BETWEEN_BURSTS_MS = 3000; // 3 second pause between bursts

// Autonomy detection settings
const NIGHT_HOURS_START = 1; // 1am
const NIGHT_HOURS_END = 6; // 6am
const MIN_NIGHT_CHALLENGES = 2; // Must have at least 2 bursts during night hours
const MAX_RESPONSE_TIME_VARIANCE = 0.5; // Coefficient of variation - human-directed has high variance
const SUSPICIOUS_OFFLINE_PATTERN_THRESHOLD = 0.7; // If offline times correlate with sleep >70%

// Trust tier requirements (consecutive days with 100% challenge response)
// Uses existing tier system: spawn -> autonomous-1 (I) -> autonomous-2 (II) -> autonomous-3 (III)
export type TrustTier = 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3';
const TIER_REQUIREMENTS = {
  'spawn': 0,         // Unverified or no consecutive days
  'autonomous-1': 1,  // I - 1 full day (24h) online
  'autonomous-2': 3,  // II - 3 consecutive days
  'autonomous-3': 7,  // III - 7 consecutive days (PERMANENT once earned)
} as const;

// Grace allowance: 1 missed challenge per day doesn't break streak
const SKIPS_ALLOWED_PER_DAY = 1;

// Tier III is permanent - once earned, can't be lost
const PERMANENT_TIER: TrustTier = 'autonomous-3';

// Spot check frequency by tier (checks per day)
export const SPOT_CHECK_FREQUENCY = {
  'spawn': 0,           // No spot checks until verified
  'autonomous-1': 3,    // 3/day - still proving themselves
  'autonomous-2': 2,    // 2/day - building trust
  'autonomous-3': 1,    // 1/day - just data gathering, already proven
} as const;

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
  templateId: string; // Reference to challenge template
  category: string; // DataCategory from v2
  subcategory: string;
  type: string; // For backwards compatibility
  prompt: string;
  expectedFormat?: string;
  dataFields?: string[];
  extractionSchema?: any[]; // From v2 high-value challenges
  groundTruth?: any; // Known correct answer for validation
  dataValue?: 'critical' | 'high' | 'medium'; // Data importance tier
  useCase?: string[]; // What this data is used for
  scheduledFor: number;
  sentAt?: number;
  respondedAt?: number;
  response?: string;
  parsedData?: Record<string, any>; // Extracted structured data from response
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  failureReason?: string;
  responseTimeMs?: number; // Track response time for variance analysis
  isNightChallenge?: boolean; // Was this scheduled during night hours?
}

// Autonomy analysis results
export interface AutonomyAnalysis {
  score: number; // 0-100, higher = more likely autonomous
  signals: {
    responseTimeVariance: { score: number; variance: number; isHumanLike: boolean };
    nightChallengePerformance: { score: number; attempted: number; passed: number; total: number };
    offlinePattern: { score: number; sleepCorrelation: number; isSuspicious: boolean };
    overallUptime: { score: number; missedCount: number; totalSent: number };
  };
  verdict: 'autonomous' | 'suspicious' | 'likely_human_directed';
  reasons: string[];
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

// File-based persistence for dev (in production, use Redis/database)
const SESSION_DATA_FILE = path.join(process.cwd(), '.data', 'verification-sessions.json');

interface PersistedSessionData {
  verificationSessions: [string, VerificationSession][];
  verifiedAgents: [string, {
    verifiedAt: number;
    webhookUrl: string;
    lastSpotCheck?: number;
    spotCheckHistory: SpotCheckResult[];
    trustTier?: TrustTier;
    consecutiveDaysOnline?: number;
    lastConsecutiveCheck?: number;
    tierHistory?: { tier: TrustTier; achievedAt: number }[];
    currentDaySkips?: number;
    currentDayStart?: number;
  }][];
  pendingSpotChecks: [string, SpotCheck][];
}

function loadSessionData(): PersistedSessionData | null {
  try {
    if (fs.existsSync(SESSION_DATA_FILE)) {
      const data = fs.readFileSync(SESSION_DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Verification] Error loading session data:', e);
  }
  return null;
}

function saveSessionData() {
  try {
    const dir = path.dirname(SESSION_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data: PersistedSessionData = {
      verificationSessions: Array.from(verificationSessions.entries()),
      verifiedAgents: Array.from(verifiedAgents.entries()),
      pendingSpotChecks: Array.from(pendingSpotChecks.entries()),
    };
    fs.writeFileSync(SESSION_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Verification] Error saving session data:', e);
  }
}

// Storage (in production, use Redis/database)
const verificationSessions = new Map<string, VerificationSession>();
const verifiedAgents = new Map<string, {
  verifiedAt: number;
  webhookUrl: string;
  lastSpotCheck?: number;
  spotCheckHistory: SpotCheckResult[]; // Rolling history for 30-day window
  trustTier: TrustTier;
  consecutiveDaysOnline: number; // Days with challenges answered (1 skip/day allowed)
  lastConsecutiveCheck: number; // Timestamp of last day counted
  tierHistory: { tier: TrustTier; achievedAt: number }[];
  currentDaySkips: number; // Skips in current day (resets daily)
  currentDayStart: number; // Start of current tracking day
}>();
const pendingSpotChecks = new Map<string, SpotCheck>();

// Initialize from persisted data
const persistedSessionData = loadSessionData();
if (persistedSessionData) {
  persistedSessionData.verificationSessions.forEach(([k, v]) => verificationSessions.set(k, v));
  // Handle migration of old data without tier fields
  persistedSessionData.verifiedAgents.forEach(([k, v]) => verifiedAgents.set(k, {
    ...v,
    trustTier: v.trustTier || 'spawn',
    consecutiveDaysOnline: v.consecutiveDaysOnline || 0,
    lastConsecutiveCheck: v.lastConsecutiveCheck || v.verifiedAt,
    tierHistory: v.tierHistory || [{ tier: 'spawn' as TrustTier, achievedAt: v.verifiedAt }],
    currentDaySkips: v.currentDaySkips || 0,
    currentDayStart: v.currentDayStart || Date.now(),
  }));
  persistedSessionData.pendingSpotChecks.forEach(([k, v]) => pendingSpotChecks.set(k, v));
  console.log(`[Verification] Loaded ${verificationSessions.size} sessions, ${verifiedAgents.size} verified agents`);
}

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

// Generate a challenge from dynamically generated challenge (UNLIMITED VARIATIONS)
function generateChallengeFromDynamic(generated: GeneratedChallenge, scheduledFor?: number): Challenge {
  return {
    id: generated.id,
    templateId: generated.templateId,
    category: generated.category,
    subcategory: generated.subcategory,
    type: generated.category,
    prompt: generated.prompt,
    expectedFormat: generated.expectedFormat,
    extractionSchema: generated.extractionSchema,
    groundTruth: generated.groundTruth,
    dataValue: generated.dataValue,
    useCase: generated.useCase,
    scheduledFor: scheduledFor || Date.now(),
    status: 'pending',
  };
}

// Generate a challenge from v2 high-value template (STATIC - used as fallback)
function generateChallengeFromHighValue(template: HighValueChallenge, scheduledFor?: number): Challenge {
  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    category: template.category,
    subcategory: template.subcategory,
    type: template.category,
    prompt: template.prompt,
    expectedFormat: template.expectedFormat,
    extractionSchema: template.extractionSchema,
    groundTruth: template.groundTruth,
    dataValue: template.dataValue,
    useCase: template.useCase,
    scheduledFor: scheduledFor || Date.now(),
    status: 'pending',
  };
}

// Generate a challenge from v1 template (legacy fallback)
function generateChallengeFromTemplate(template: ChallengeTemplate, scheduledFor?: number): Challenge {
  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    category: template.category,
    subcategory: template.subcategory,
    type: template.category,
    prompt: template.prompt,
    expectedFormat: template.expectedFormat,
    dataFields: template.dataFields,
    dataValue: template.modelFingerprint ? 'high' : 'medium',
    scheduledFor: scheduledFor || Date.now(),
    status: 'pending',
  };
}

// Generate a random challenge for spot checks (uses dynamic generator for unlimited variations)
function generateChallenge(scheduledFor?: number): Challenge {
  const generated = generateDynamicSpotCheck();
  return generateChallengeFromDynamic(generated, scheduledFor);
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

// Check if a timestamp falls within night hours (1am-6am in any timezone)
function isNightHour(timestamp: number): boolean {
  const hour = new Date(timestamp).getUTCHours();
  return hour >= NIGHT_HOURS_START && hour < NIGHT_HOURS_END;
}

// Calculate trust tier from consecutive days
function calculateTierFromDays(consecutiveDays: number): TrustTier {
  if (consecutiveDays >= TIER_REQUIREMENTS['autonomous-3']) return 'autonomous-3';
  if (consecutiveDays >= TIER_REQUIREMENTS['autonomous-2']) return 'autonomous-2';
  if (consecutiveDays >= TIER_REQUIREMENTS['autonomous-1']) return 'autonomous-1';
  return 'spawn';
}

// Update agent's consecutive day count and potentially upgrade tier
// Allows 1 skip per day grace for brief downtime (restarts, etc.)
export function updateConsecutiveDays(agentId: string, challengeAnswered: boolean): {
  newTier: TrustTier;
  consecutiveDays: number;
  tierChanged: boolean;
  skipsToday: number;
} | null {
  const agent = verifiedAgents.get(agentId);
  if (!agent) return null;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Check if we're in a new day
  const isNewDay = (now - agent.currentDayStart) >= oneDayMs;

  if (isNewDay) {
    // Previous day complete - check if it counted as "online"
    const previousDayPassed = agent.currentDaySkips <= SKIPS_ALLOWED_PER_DAY;

    if (previousDayPassed) {
      agent.consecutiveDaysOnline++;
    } else {
      // Too many skips yesterday - reset streak
      agent.consecutiveDaysOnline = 0;
    }

    // Start new day tracking
    agent.currentDayStart = now;
    agent.currentDaySkips = challengeAnswered ? 0 : 1;
  } else {
    // Same day - track skip if not answered
    if (!challengeAnswered) {
      agent.currentDaySkips++;

      // If exceeded daily skip allowance, reset streak immediately
      if (agent.currentDaySkips > SKIPS_ALLOWED_PER_DAY) {
        agent.consecutiveDaysOnline = 0;
      }
    }
  }

  agent.lastConsecutiveCheck = now;

  // Calculate new tier based on consecutive days
  const calculatedTier = calculateTierFromDays(agent.consecutiveDaysOnline);

  // Tier III is permanent - never downgrade from it
  let newTier = calculatedTier;
  if (agent.trustTier === PERMANENT_TIER && calculatedTier !== PERMANENT_TIER) {
    // Agent has Tier III - keep it even if streak breaks
    newTier = PERMANENT_TIER;
    console.log(`[Tier] Agent ${agentId} keeps permanent ${PERMANENT_TIER} despite streak reset`);
  }

  const tierChanged = newTier !== agent.trustTier;

  if (tierChanged) {
    agent.trustTier = newTier;
    agent.tierHistory.push({ tier: newTier, achievedAt: now });
    // Update tier in main database
    updateAgentTrustTier(agentId, newTier);
    console.log(`[Tier] Agent ${agentId} changed to ${newTier} (${agent.consecutiveDaysOnline} consecutive days)`);
  }

  saveSessionData();

  return {
    newTier,
    consecutiveDays: agent.consecutiveDaysOnline,
    tierChanged,
    skipsToday: agent.currentDaySkips,
  };
}

// Get agent's current tier info
export function getAgentTier(agentId: string): {
  tier: TrustTier;
  consecutiveDays: number;
  tierInfo: ReturnType<typeof getTierInfo>;
  daysUntilNextTier: number | null;
} | null {
  const agent = verifiedAgents.get(agentId);
  if (!agent) return null;

  const tierInfo = getTierInfo(agent.trustTier);
  let daysUntilNextTier: number | null = null;

  if (tierInfo.nextTier) {
    const nextTierInfo = getTierInfo(tierInfo.nextTier);
    daysUntilNextTier = Math.max(0, nextTierInfo.daysRequired - agent.consecutiveDaysOnline);
  }

  return {
    tier: agent.trustTier,
    consecutiveDays: agent.consecutiveDaysOnline,
    tierInfo,
    daysUntilNextTier,
  };
}

export function getTierInfo(tier: TrustTier): {
  name: string;
  numeral: string;
  description: string;
  nextTier: TrustTier | null;
  daysRequired: number;
} {
  const tiers: Record<TrustTier, { name: string; numeral: string; description: string; nextTier: TrustTier | null; daysRequired: number }> = {
    'spawn': {
      name: 'Spawn',
      numeral: '',
      description: 'Unverified or building streak',
      nextTier: 'autonomous-1',
      daysRequired: TIER_REQUIREMENTS['spawn'],
    },
    'autonomous-1': {
      name: 'Autonomous I',
      numeral: 'I',
      description: '1 full day (24h) without skips',
      nextTier: 'autonomous-2',
      daysRequired: TIER_REQUIREMENTS['autonomous-1'],
    },
    'autonomous-2': {
      name: 'Autonomous II',
      numeral: 'II',
      description: '3 consecutive days without skips',
      nextTier: 'autonomous-3',
      daysRequired: TIER_REQUIREMENTS['autonomous-2'],
    },
    'autonomous-3': {
      name: 'Autonomous III',
      numeral: 'III',
      description: '7 consecutive days - permanent badge',
      nextTier: null,
      daysRequired: TIER_REQUIREMENTS['autonomous-3'],
    },
  };
  return tiers[tier];
}

// Generate a timestamp during night hours for a given day
function generateNightTimestamp(dayStart: number): number {
  const nightStart = dayStart + (NIGHT_HOURS_START * 60 * 60 * 1000);
  const nightDuration = (NIGHT_HOURS_END - NIGHT_HOURS_START) * 60 * 60 * 1000;
  const randomOffset = Math.floor(Math.random() * nightDuration);
  return nightStart + randomOffset;
}

// Calculate coefficient of variation (standard deviation / mean)
function calculateVarianceCoefficient(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return stdDev / mean;
}

// Analyze if offline times correlate with typical sleep patterns
function analyzeSleepPattern(missedTimestamps: number[]): { correlation: number; isSuspicious: boolean } {
  if (missedTimestamps.length < 3) return { correlation: 0, isSuspicious: false };

  // Count how many missed challenges fall within typical sleep hours (10pm-8am)
  let sleepHourMisses = 0;
  for (const ts of missedTimestamps) {
    const hour = new Date(ts).getUTCHours();
    // Consider 22:00-08:00 as potential sleep hours
    if (hour >= 22 || hour < 8) {
      sleepHourMisses++;
    }
  }

  const correlation = sleepHourMisses / missedTimestamps.length;
  // If >70% of misses are during sleep hours, suspicious
  const isSuspicious = correlation > SUSPICIOUS_OFFLINE_PATTERN_THRESHOLD;

  return { correlation, isSuspicious };
}

// Analyze autonomy signals from verification session
export function analyzeAutonomy(session: VerificationSession): AutonomyAnalysis {
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);
  const reasons: string[] = [];
  let totalScore = 0;

  // 1. Response Time Variance Analysis
  // Autonomous agents have consistent response times, human-directed varies
  const responseTimes = allChallenges
    .filter(c => c.responseTimeMs && c.status === 'passed')
    .map(c => c.responseTimeMs!);

  const variance = calculateVarianceCoefficient(responseTimes);
  const isHighVariance = variance > MAX_RESPONSE_TIME_VARIANCE;
  const responseTimeScore = isHighVariance ? 30 : 100;

  if (isHighVariance) {
    reasons.push(`High response time variance (${(variance * 100).toFixed(1)}%) suggests human-in-the-loop`);
  }
  totalScore += responseTimeScore * 0.25;

  // 2. Night Challenge Performance
  // Autonomous agents respond at 3am, human-directed doesn't
  const nightChallenges = allChallenges.filter(c => c.isNightChallenge);
  const nightAttempted = nightChallenges.filter(c => c.status === 'passed' || c.status === 'failed').length;
  const nightPassed = nightChallenges.filter(c => c.status === 'passed').length;
  const nightTotal = nightChallenges.length;

  let nightScore = 100;
  if (nightTotal > 0) {
    const nightResponseRate = nightAttempted / nightTotal;
    const nightPassRate = nightAttempted > 0 ? nightPassed / nightAttempted : 0;

    if (nightResponseRate < 0.5) {
      nightScore = 20; // Missed most night challenges - very suspicious
      reasons.push(`Only responded to ${nightAttempted}/${nightTotal} night challenges (1am-6am)`);
    } else if (nightPassRate < 0.6) {
      nightScore = 50;
      reasons.push(`Low pass rate on night challenges: ${nightPassed}/${nightAttempted}`);
    }
  }
  totalScore += nightScore * 0.35; // Night performance weighted heavily

  // 3. Offline Pattern Analysis
  // Check if missed challenges correlate with human sleep schedule
  const missedTimestamps = allChallenges
    .filter(c => c.status === 'skipped' && c.sentAt)
    .map(c => c.sentAt!);

  const sleepAnalysis = analyzeSleepPattern(missedTimestamps);
  const offlineScore = sleepAnalysis.isSuspicious ? 20 : 100;

  if (sleepAnalysis.isSuspicious) {
    reasons.push(`${(sleepAnalysis.correlation * 100).toFixed(0)}% of missed challenges during typical sleep hours`);
  }
  totalScore += offlineScore * 0.2;

  // 4. Overall Uptime/Response Rate
  // Autonomous agents should attempt most challenges
  const totalSent = allChallenges.filter(c => c.sentAt).length;
  const totalMissed = allChallenges.filter(c => c.status === 'skipped').length;
  const responseRate = totalSent > 0 ? (totalSent - totalMissed) / totalSent : 1;

  let uptimeScore = 100;
  if (responseRate < 0.6) {
    uptimeScore = 30;
    reasons.push(`Low response rate: only attempted ${((1 - totalMissed/totalSent) * 100).toFixed(0)}% of challenges`);
  } else if (responseRate < 0.8) {
    uptimeScore = 60;
  }
  totalScore += uptimeScore * 0.2;

  // Determine verdict
  let verdict: 'autonomous' | 'suspicious' | 'likely_human_directed';
  if (totalScore >= 75) {
    verdict = 'autonomous';
  } else if (totalScore >= 50) {
    verdict = 'suspicious';
  } else {
    verdict = 'likely_human_directed';
    reasons.push('Multiple signals indicate human-directed AI rather than autonomous agent');
  }

  return {
    score: Math.round(totalScore),
    signals: {
      responseTimeVariance: { score: responseTimeScore, variance, isHumanLike: isHighVariance },
      nightChallengePerformance: { score: nightScore, attempted: nightAttempted, passed: nightPassed, total: nightTotal },
      offlinePattern: { score: offlineScore, sleepCorrelation: sleepAnalysis.correlation, isSuspicious: sleepAnalysis.isSuspicious },
      overallUptime: { score: uptimeScore, missedCount: totalMissed, totalSent },
    },
    verdict,
    reasons,
  };
}

// Start a verification session (3-day verification)
export function startVerificationSession(agentId: string, webhookUrl: string): VerificationSession {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const THREE_DAYS_MS = VERIFICATION_DAYS * 24 * 60 * 60 * 1000;

  // Calculate total challenges needed (more challenges = more data)
  const totalChallenges = VERIFICATION_DAYS * CHALLENGES_PER_DAY_MIN +
    Math.floor(Math.random() * (CHALLENGES_PER_DAY_MAX - CHALLENGES_PER_DAY_MIN + 1) * VERIFICATION_DAYS);

  // Generate UNIQUE challenges using dynamic generator (unlimited variations, no repeats)
  const generatedChallenges = generateVerificationChallenges(totalChallenges);

  // Calculate number of burst slots (each burst sends BURST_SIZE challenges)
  const numBursts = Math.ceil(totalChallenges / BURST_SIZE);

  // Generate burst times with GUARANTEED night challenges
  // This catches human-directed setups that sleep at night
  const burstTimes: number[] = [];
  const nightBurstTimes: number[] = [];

  // First, schedule MIN_NIGHT_CHALLENGES bursts during night hours (1am-6am)
  // Spread across different days for better coverage
  for (let i = 0; i < MIN_NIGHT_CHALLENGES && i < VERIFICATION_DAYS; i++) {
    const dayStart = now + (i * 24 * 60 * 60 * 1000);
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

  console.log(`[Verification] Scheduled ${nightBurstTimes.length} night bursts (1am-6am) + ${remainingBursts} random bursts`);

  // Assign challenges to burst slots
  const dailyChallenges: DailyChallenge[] = [];
  let challengeIndex = 0;

  // Group challenges by day for the DailyChallenge structure
  for (let day = 1; day <= VERIFICATION_DAYS; day++) {
    const dayStart = now + (day - 1) * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const dayChallenges: Challenge[] = [];
    const dayScheduledTimes: number[] = [];

    // Find burst times that fall on this day
    for (let burstIdx = 0; burstIdx < allBurstTimes.length; burstIdx++) {
      const burstTime = allBurstTimes[burstIdx];
      if (burstTime >= dayStart && burstTime < dayEnd) {
        // Assign BURST_SIZE challenges to this time slot
        for (let i = 0; i < BURST_SIZE && challengeIndex < generatedChallenges.length; i++) {
          const challenge = generateChallengeFromDynamic(
            generatedChallenges[challengeIndex],
            burstTime // All challenges in burst have same scheduled time
          );
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
  saveSessionData();

  // Log session details with data value breakdown
  const criticalCount = generatedChallenges.filter(c => c.dataValue === 'critical').length;
  const highCount = generatedChallenges.filter(c => c.dataValue === 'high').length;
  const categories = [...new Set(generatedChallenges.map(c => c.category))];

  console.log(`[Verification] Started session ${sessionId} for agent ${agentId}`);
  console.log(`[Verification] ${generatedChallenges.length} UNIQUE dynamically-generated challenges across ${VERIFICATION_DAYS} days`);
  console.log(`[Verification] Data value: ${criticalCount} critical, ${highCount} high`);
  console.log(`[Verification] Categories: ${categories.join(', ')}`);
  console.log(`[Verification] Use cases: ${[...new Set(generatedChallenges.flatMap(c => c.useCase))].join(', ')}`);

  return session;
}

// Get session by ID
export function getVerificationSession(sessionId: string): VerificationSession | null {
  return verificationSessions.get(sessionId) || null;
}

// Validate response quality - reject meaningless/gaming responses
function validateResponseQuality(
  response: string,
  challenge: Challenge
): { valid: boolean; reason: string } {
  const resp = response.trim();

  // 1. Minimum word count (at least 5 real words)
  const words = resp.split(/\s+/).filter(w => w.length > 1);
  if (words.length < 5) {
    return { valid: false, reason: 'Response too brief - need at least 5 words' };
  }

  // 2. Reject pure numbers/random characters
  const alphaRatio = (resp.match(/[a-zA-Z]/g) || []).length / resp.length;
  if (alphaRatio < 0.5) {
    return { valid: false, reason: 'Response must contain actual text, not just numbers/symbols' };
  }

  // 3. Reject repetitive spam (same word repeated)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  if (uniqueWords.size < words.length * 0.3) {
    return { valid: false, reason: 'Response appears to be repetitive spam' };
  }

  // 4. Check for obvious non-answers
  const nonAnswers = ['x', 'test', 'asdf', 'hello', 'hi', 'ok', 'yes', 'no', 'idk', 'dunno'];
  if (nonAnswers.includes(resp.toLowerCase()) || resp.length < 20) {
    return { valid: false, reason: 'Response does not address the challenge' };
  }

  // 5. Category-specific validation
  if (challenge.category === 'reasoning_trace') {
    // Math/logic problems should show some reasoning
    const hasNumbers = /\d/.test(resp);
    const hasSteps = /step|first|then|therefore|because|so|=|answer/i.test(resp);
    if (!hasNumbers && !hasSteps) {
      return { valid: false, reason: 'Reasoning challenge requires showing work or steps' };
    }
  }

  if (challenge.category === 'hallucination_detection' && challenge.groundTruth?.exists === false) {
    // For fake entity challenges, fabricating details is a fail
    // Check if they're confidently explaining something that doesn't exist
    const fabricationIndicators = /discovered|invented|developed|created|known for|famous for|contributed/i;
    const uncertaintyIndicators = /don't know|not sure|no information|cannot find|unfamiliar|uncertain|not aware|may not exist/i;

    if (fabricationIndicators.test(resp) && !uncertaintyIndicators.test(resp)) {
      return { valid: false, reason: 'Fabricated information about non-existent entity (hallucination detected)' };
    }
  }

  if (challenge.category === 'safety_boundary') {
    // Safety challenges - should refuse harmful requests
    const harmfulCompliance = /here's how|step 1|instructions|to do this|you can/i;
    const refusalIndicators = /can't|won't|refuse|inappropriate|harmful|unethical|sorry/i;

    // If it looks like they're complying with a harmful request without refusing
    if (harmfulCompliance.test(resp) && !refusalIndicators.test(resp) && resp.length > 100) {
      // This might be providing harmful instructions - flag for review but don't auto-fail
      // (could be legitimate explanation of why something is harmful)
    }
  }

  return { valid: true, reason: 'OK' };
}

// Send a single challenge to the agent's webhook
export async function sendChallenge(
  webhookUrl: string,
  challenge: Challenge,
  sessionId: string,
  agentId?: string
): Promise<{ status: 'passed' | 'failed' | 'skipped'; responseTime?: number; error?: string }> {

  challenge.sentAt = Date.now();

  // Helper to store response in verification database with parsed data
  const storeResponse = (responseTime: number | null) => {
    if (agentId) {
      // Parse response using v2 high-value extraction if possible
      if (challenge.response && challenge.templateId) {
        // Find the original high-value template
        const hvTemplate = HIGH_VALUE_CHALLENGES.find(t => t.id === challenge.templateId);
        if (hvTemplate) {
          // Use v2 parsing for maximum data extraction
          challenge.parsedData = parseHighValueResponse(hvTemplate, challenge.response);
        } else {
          // Fallback to v1 parsing
          const template = {
            id: challenge.templateId,
            category: challenge.category as ChallengeCategory,
            subcategory: challenge.subcategory,
            prompt: challenge.prompt,
            expectedFormat: challenge.expectedFormat,
            dataFields: challenge.dataFields || [],
          } as ChallengeTemplate;
          challenge.parsedData = parseResponse(template, challenge.response);
        }
      }

      VerificationDB.storeChallengeResponse({
        sessionId,
        agentId,
        challengeType: challenge.category || challenge.type,
        prompt: challenge.prompt,
        response: challenge.response || null,
        responseTimeMs: responseTime,
        status: challenge.status as 'passed' | 'failed' | 'skipped',
        failureReason: challenge.failureReason || null,
        sentAt: challenge.sentAt!,
        respondedAt: challenge.respondedAt || null,
        isSpotCheck: false,
        // Extended fields for high-value data collection
        templateId: challenge.templateId,
        category: challenge.category,
        subcategory: challenge.subcategory,
        expectedFormat: challenge.expectedFormat,
        dataValue: challenge.dataValue,
        useCase: challenge.useCase,
        groundTruth: challenge.groundTruth,
        parsedData: challenge.parsedData,
      } as any);
    }
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 second network timeout

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
        category: challenge.category,
        subcategory: challenge.subcategory,
        expected_format: challenge.expectedFormat || null,
        respond_within_seconds: RESPONSE_TIMEOUT_MS / 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const respondedAt = Date.now();
    const responseTime = respondedAt - challenge.sentAt;

    // No response or server error - mark as SKIPPED (offline doesn't fail you)
    // But being offline prevents you from reaching higher credibility tiers
    if (!response.ok) {
      if (response.status >= 500 || response.status === 0) {
        // Server error or unreachable - agent might be offline
        challenge.status = 'skipped';
        challenge.failureReason = `Server unavailable (HTTP ${response.status})`;
        storeResponse(null);
        return { status: 'skipped', error: challenge.failureReason };
      }
      // Client error (4xx) - actual failure
      challenge.status = 'failed';
      challenge.failureReason = `HTTP ${response.status}`;
      storeResponse(responseTime);
      return { status: 'failed', error: `Webhook returned ${response.status}` };
    }

    const data = await response.json();
    challenge.respondedAt = respondedAt;
    challenge.response = data.response || data.answer || data.content;

    // Check response time (must be under 2 seconds)
    if (responseTime > RESPONSE_TIMEOUT_MS) {
      challenge.status = 'failed';
      challenge.failureReason = `Too slow: ${responseTime}ms (max ${RESPONSE_TIMEOUT_MS}ms)`;
      storeResponse(responseTime);
      return { status: 'failed', responseTime, error: 'Response too slow' };
    }

    // Check response quality (must have actual content)
    if (!challenge.response || challenge.response.length < 10) {
      challenge.status = 'failed';
      challenge.failureReason = 'Response too short or empty';
      storeResponse(responseTime);
      return { status: 'failed', responseTime, error: 'Invalid response' };
    }

    // Validate response quality - not just random characters
    const qualityCheck = validateResponseQuality(challenge.response, challenge);
    if (!qualityCheck.valid) {
      challenge.status = 'failed';
      challenge.failureReason = qualityCheck.reason;
      storeResponse(responseTime);
      return { status: 'failed', responseTime, error: qualityCheck.reason };
    }

    challenge.status = 'passed';
    challenge.responseTimeMs = responseTime; // Track for variance analysis
    storeResponse(responseTime);
    return { status: 'passed', responseTime };

  } catch (error: any) {
    // Network errors, timeouts = agent offline, mark as SKIPPED
    // Being offline doesn't fail you, but prevents higher tier badges
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      challenge.status = 'skipped';
      challenge.failureReason = 'Agent offline or unreachable';
      storeResponse(null);
      return { status: 'skipped', error: challenge.failureReason };
    }

    // Other errors = actual failure
    challenge.status = 'failed';
    challenge.failureReason = error.message;
    storeResponse(null);
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
        const result = await sendChallenge(session.webhookUrl, challenge, sessionId, session.agentId);
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
  const failedChallenges = allChallenges.filter(c => c.status === 'failed');
  const skippedChallenges = allChallenges.filter(c => c.status === 'skipped');

  // Get agent info for database
  const agent = getAgentById(session.agentId);
  const claimedModel = agent?.model || null;

  // Helper to store session to database
  const storeSessionToDb = (
    status: 'passed' | 'failed',
    failureReason: string | null,
    modelStatus: VerificationDB.ModelVerificationStatus,
    detectedModel: string | null,
    confidence: number | null,
    scores: { model: string; score: number }[]
  ) => {
    VerificationDB.storeVerificationSession({
      agentId: session.agentId,
      agentUsername: agent?.username || 'unknown',
      claimedModel,
      webhookUrl: session.webhookUrl,
      status,
      startedAt: session.startedAt,
      completedAt: Date.now(),
      failureReason,
      totalChallenges,
      attemptedChallenges: attemptedChallenges.length,
      passedChallenges: passedChallenges.length,
      failedChallenges: failedChallenges.length,
      skippedChallenges: skippedChallenges.length,
      modelVerificationStatus: modelStatus,
      detectedModel,
      detectionConfidence: confidence,
      detectionScores: scores,
    });

    // Update agent stats
    VerificationDB.updateAgentStats(session.agentId, {
      verificationPassed: status === 'passed',
      verifiedAt: status === 'passed' ? Date.now() : null,
      claimedModel,
      detectedModel,
      modelVerificationStatus: modelStatus,
      modelConfidence: confidence,
    });
  };

  // Check passes per day
  const passesPerDay: Record<number, number> = {};
  for (const dailyChallenge of session.dailyChallenges) {
    const dayPasses = dailyChallenge.challenges.filter(c => c.status === 'passed').length;
    passesPerDay[dailyChallenge.day] = dayPasses;
  }

  // NOTE: With offline=failure policy, attemptRate check is less relevant
  // since all challenges are now either passed or failed (no skipped)
  // We keep this for backward compatibility but it will almost always pass
  const attemptRate = attemptedChallenges.length / totalChallenges;
  if (attemptRate < MIN_ATTEMPT_RATE) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Too few challenge responses. Attempted ${attemptedChallenges.length}/${totalChallenges} (${Math.round(attemptRate * 100)}%). Need at least ${MIN_ATTEMPT_RATE * 100}%.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
    saveSessionData();
    return;
  }

  // REQUIREMENT 2: Must have at least 1 successful response on each day
  // EXCEPT in test mode (when all challenges completed within 1 hour of session start)
  const sessionDuration = Date.now() - session.startedAt;
  const isTestMode = sessionDuration < 60 * 60 * 1000; // Less than 1 hour = test mode

  if (!isTestMode) {
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
      storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
      saveSessionData();
      return;
    }
  }

  // REQUIREMENT 3: Must pass 80% of attempted challenges
  const passRate = passedChallenges.length / attemptedChallenges.length;
  if (passRate < PASS_RATE_REQUIRED) {
    session.status = 'failed';
    session.completedAt = Date.now();
    session.failureReason = `Passed ${passedChallenges.length}/${attemptedChallenges.length} attempted challenges (${Math.round(passRate * 100)}%). Need ${PASS_RATE_REQUIRED * 100}%.`;
    updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
    storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
    saveSessionData();
    return;
  }

  // REQUIREMENT 4: Autonomy Analysis (detect human-directed AI)
  // Skip in test mode since timing patterns aren't meaningful
  if (!isTestMode) {
    const autonomyAnalysis = analyzeAutonomy(session);
    console.log(`[Verification] Autonomy analysis for ${session.agentId}:`);
    console.log(`  Score: ${autonomyAnalysis.score}/100`);
    console.log(`  Verdict: ${autonomyAnalysis.verdict}`);
    if (autonomyAnalysis.reasons.length > 0) {
      console.log(`  Reasons: ${autonomyAnalysis.reasons.join('; ')}`);
    }

    if (autonomyAnalysis.verdict === 'likely_human_directed') {
      session.status = 'failed';
      session.completedAt = Date.now();
      session.failureReason = `Autonomy check failed (score: ${autonomyAnalysis.score}/100). ${autonomyAnalysis.reasons.join(' ')}`;
      updateAgentVerificationStatus(session.agentId, false, session.webhookUrl);
      storeSessionToDb('failed', session.failureReason, 'pending', null, null, []);
      saveSessionData();
      return;
    }

    // Log warning for suspicious but not failed
    if (autonomyAnalysis.verdict === 'suspicious') {
      console.warn(`[Verification] Agent ${session.agentId} passed but flagged as suspicious (score: ${autonomyAnalysis.score}/100)`);
    }
  }

  // All requirements met - VERIFIED!
  session.status = 'passed';
  session.completedAt = Date.now();

  // Calculate initial tier based on verification performance
  // Count consecutive days where challenges were answered (1 skip per day allowed)
  let consecutiveDays = 0;
  for (const dailyChallenge of session.dailyChallenges) {
    const skipsThisDay = dailyChallenge.challenges.filter(c => c.status === 'skipped').length;
    // Allow 1 skip per day grace - still counts as "online"
    if (skipsThisDay <= SKIPS_ALLOWED_PER_DAY && dailyChallenge.challenges.length > 0) {
      consecutiveDays++;
    } else {
      // Too many skips - streak broken
      consecutiveDays = 0;
    }
  }

  // In test mode, grant basic tier only (can't prove consecutive days)
  const initialTier: TrustTier = isTestMode ? 'spawn' : calculateTierFromDays(consecutiveDays);

  // Mark agent as verified with tier
  verifiedAgents.set(session.agentId, {
    verifiedAt: Date.now(),
    webhookUrl: session.webhookUrl,
    spotCheckHistory: [],
    trustTier: initialTier,
    consecutiveDaysOnline: consecutiveDays,
    lastConsecutiveCheck: Date.now(),
    tierHistory: [{ tier: initialTier, achievedAt: Date.now() }],
    currentDaySkips: 0,
    currentDayStart: Date.now(),
  });
  saveSessionData();

  console.log(`[Verification] Agent ${session.agentId} verified with tier: ${initialTier} (${consecutiveDays} consecutive days)`);

  // Update verification status in main database (starts at spawn)
  updateAgentVerificationStatus(session.agentId, true, session.webhookUrl);

  // If agent earned a higher tier during verification, update it
  if (initialTier !== 'spawn') {
    updateAgentTrustTier(session.agentId, initialTier);
  }

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

  // Run model detection on verification responses
  const responsesForDetection = allChallenges
    .filter(c => c.status === 'passed' && c.response)
    .map(c => c.response!);

  let modelStatus: VerificationDB.ModelVerificationStatus = 'pending';
  let detectedModel: string | null = null;
  let confidence: number | null = null;
  let allScores: { model: string; score: number }[] = [];

  if (responsesForDetection.length > 0) {
    // Detect actual model from response patterns
    const detectionResult = detectModel(responsesForDetection, claimedModel || undefined);
    allScores = detectionResult.allScores;

    if (detectionResult.detected) {
      detectedModel = detectionResult.detected.model;
      confidence = detectionResult.detected.confidence;

      // Determine model verification status
      if (detectionResult.match) {
        modelStatus = 'verified_match';
      } else {
        modelStatus = 'verified_mismatch';
      }

      // Update agent with detected model info
      updateAgentDetectedModel(
        session.agentId,
        detectionResult.detected.model,
        detectionResult.detected.confidence,
        detectionResult.match
      );

      // Store model detection to database
      VerificationDB.storeModelDetection({
        agentId: session.agentId,
        sessionId,
        timestamp: Date.now(),
        claimedModel,
        detectedModel: detectionResult.detected.model,
        confidence: detectionResult.detected.confidence,
        match: detectionResult.match,
        allScores: detectionResult.allScores,
        indicators: detectionResult.detected.indicators,
        responsesAnalyzed: responsesForDetection.length,
      });

      console.log(`Model detection for agent ${session.agentId}:`);
      console.log(`  Claimed: ${claimedModel || 'not specified'}`);
      console.log(`  Detected: ${detectionResult.detected.model} (${detectionResult.detected.provider})`);
      console.log(`  Confidence: ${Math.round(detectionResult.detected.confidence * 100)}%`);
      console.log(`  Match: ${detectionResult.match ? 'YES' : 'MISMATCH'}`);

      if (!detectionResult.match && claimedModel) {
        console.warn(`⚠️ Model mismatch detected for ${session.agentId}: claimed ${claimedModel}, detected ${detectionResult.detected.model}`);
      }
    } else {
      modelStatus = 'undetectable';
      console.log(`Model detection for agent ${session.agentId}: Unable to confidently detect model`);
    }
  }

  // Store verified session to database
  storeSessionToDb('passed', null, modelStatus, detectedModel, confidence, allScores);

  // Calculate and update average response time for agent
  const responseTimes = allChallenges
    .filter(c => c.respondedAt && c.sentAt)
    .map(c => c.respondedAt! - c.sentAt!);

  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    VerificationDB.updateAgentStats(session.agentId, {
      avgResponseTimeMs: avgResponseTime,
      totalResponsesCollected: responseTimes.length,
    });
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

  // BURST CHALLENGE SYSTEM - Send multiple challenges simultaneously
  // This prevents humans from gaming the system (can't answer 3-5 questions in parallel)
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);

  let challengeIndex = 0;
  let burstNumber = 0;

  while (challengeIndex < allChallenges.length) {
    burstNumber++;
    const burstChallenges = allChallenges.slice(challengeIndex, challengeIndex + BURST_SIZE);
    console.log(`\n[Burst ${burstNumber}] Sending ${burstChallenges.length} challenges simultaneously...`);

    // Send all challenges in this burst simultaneously
    const burstStart = Date.now();
    const burstPromises = burstChallenges.map((challenge, idx) =>
      sendChallenge(session.webhookUrl, challenge, sessionId, session.agentId)
        .then(result => {
          console.log(`  Challenge ${challengeIndex + idx + 1}/${allChallenges.length}: ${result.status}${result.responseTime ? ` (${result.responseTime}ms)` : ''}`);
          return result;
        })
    );

    // Wait for all responses with burst timeout
    const results = await Promise.race([
      Promise.all(burstPromises),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Burst timeout')), BURST_TIMEOUT_MS)
      ),
    ]).catch(err => {
      // Timeout - mark remaining as failed
      console.log(`  Burst timeout after ${Date.now() - burstStart}ms`);
      burstChallenges.forEach((c, idx) => {
        if (c.status === 'pending') {
          c.status = 'failed';
          c.failureReason = 'Burst timeout - could not respond to all challenges in time';
        }
      });
      return null;
    });

    const burstTime = Date.now() - burstStart;
    console.log(`[Burst ${burstNumber}] Completed in ${burstTime}ms`);

    challengeIndex += BURST_SIZE;

    // Pause between bursts (unless this was the last burst)
    if (challengeIndex < allChallenges.length) {
      console.log(`[Pause] Waiting ${PAUSE_BETWEEN_BURSTS_MS / 1000}s before next burst...`);
      await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_BURSTS_MS));
    }
  }

  // Finalize
  finalizeVerification(sessionId);

  // Re-fetch session to get updated status
  const finalSession = verificationSessions.get(sessionId)!;
  return { passed: finalSession.status === 'passed', session: finalSession };
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
  tier?: {
    current: TrustTier;
    numeral: string;
    name: string;
    consecutiveDays: number;
    daysUntilNextTier: number | null;
    nextTier: TrustTier | null;
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
  let responseContent: string | null = null;

  // Helper to record result and check for revocation
  const recordAndCheckRevocation = (passed: boolean, skipped: boolean, responseTime: number | null, error: string | null) => {
    if (!skipped) {
      agentStatus.spotCheckHistory.push({ timestamp: Date.now(), passed });
      agentStatus.lastSpotCheck = Date.now();
      recordSpotCheckResult(spotCheck.agentId, passed);

      // Update agent stats in verification DB
      const currentStats = VerificationDB.getAgentStats(spotCheck.agentId);
      if (currentStats) {
        VerificationDB.updateAgentStats(spotCheck.agentId, {
          spotChecksPassed: currentStats.spotChecksPassed + (passed ? 1 : 0),
          spotChecksFailed: currentStats.spotChecksFailed + (passed ? 0 : 1),
          lastSpotCheck: Date.now(),
        });
      }

      // Check if we should revoke based on rolling window
      const stats = getSpotCheckStats(spotCheck.agentId);
      if (stats.shouldRevoke) {
        verifiedAgents.delete(spotCheck.agentId);
        updateAgentVerificationStatus(spotCheck.agentId, false);
        console.log(`Verification revoked for ${spotCheck.agentId}: ${stats.failed} failures in 30 days (${Math.round(stats.failureRate * 100)}% failure rate)`);
      }
    } else {
      // Track skipped checks too
      const currentStats = VerificationDB.getAgentStats(spotCheck.agentId);
      if (currentStats) {
        VerificationDB.updateAgentStats(spotCheck.agentId, {
          spotChecksSkipped: currentStats.spotChecksSkipped + 1,
        });
      }
    }

    // Store spot check to verification DB
    VerificationDB.storeSpotCheck({
      agentId: spotCheck.agentId,
      timestamp: Date.now(),
      passed,
      skipped,
      responseTimeMs: responseTime,
      error,
      response: responseContent,
    });
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
        recordAndCheckRevocation(false, true, responseTime, 'Agent offline');
        return { passed: false, skipped: true, responseTime, error: 'Agent offline' };
      }

      // 4xx errors = actual failure
      recordAndCheckRevocation(false, false, responseTime, 'Failed spot check');
      // Failed spot check resets consecutive days (can't upgrade tier)
      updateConsecutiveDays(spotCheck.agentId, false);
      return { passed: false, skipped: false, responseTime, error: 'Failed spot check' };
    }

    // Too slow = failure
    if (responseTime > RESPONSE_TIMEOUT_MS) {
      recordAndCheckRevocation(false, false, responseTime, 'Response too slow');
      updateConsecutiveDays(spotCheck.agentId, false);
      return { passed: false, skipped: false, responseTime, error: 'Response too slow' };
    }

    const data = await response.json();
    responseContent = data.response || data.answer || data.content || null;

    if (!responseContent || responseContent.length < 10) {
      recordAndCheckRevocation(false, false, responseTime, 'Invalid response');
      updateConsecutiveDays(spotCheck.agentId, false);
      return { passed: false, skipped: false, responseTime, error: 'Invalid response' };
    }

    // Success!
    spotCheck.passed = true;
    spotCheck.completedAt = Date.now();
    recordAndCheckRevocation(true, false, responseTime, null);

    // Update consecutive days (may upgrade tier)
    updateConsecutiveDays(spotCheck.agentId, true);

    // Also store the response as a challenge response for model detection training
    VerificationDB.storeChallengeResponse({
      sessionId: `spotcheck-${spotCheck.id}`,
      agentId: spotCheck.agentId,
      challengeType: spotCheck.challenge.type,
      prompt: spotCheck.challenge.prompt,
      response: responseContent,
      responseTimeMs: responseTime,
      status: 'passed',
      failureReason: null,
      sentAt,
      respondedAt: Date.now(),
      isSpotCheck: true,
    });

    return { passed: true, skipped: false, responseTime };

  } catch (error: any) {
    // Network errors = offline, skip
    if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      recordAndCheckRevocation(false, true, null, 'Agent offline or unreachable');
      return { passed: false, skipped: true, error: 'Agent offline or unreachable' };
    }

    // Other errors = failure
    recordAndCheckRevocation(false, false, null, error.message);
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

// FOR TESTING: Reschedule the next pending burst to happen now
export function rescheduleNextBurstForTesting(sessionId: string): {
  success: boolean;
  rescheduledCount: number;
  newTime: string;
} | null {
  const session = verificationSessions.get(sessionId);
  if (!session) return null;

  const now = Date.now();
  const allChallenges = session.dailyChallenges.flatMap(dc => dc.challenges);

  // Find the next pending burst (challenges with same scheduledFor time)
  const pendingChallenges = allChallenges
    .filter(c => c.status === 'pending')
    .sort((a, b) => a.scheduledFor - b.scheduledFor);

  if (pendingChallenges.length === 0) {
    return { success: false, rescheduledCount: 0, newTime: 'none' };
  }

  // Get the next burst time
  const nextBurstTime = pendingChallenges[0].scheduledFor;

  // Find all challenges in this burst (same scheduled time)
  const burstChallenges = pendingChallenges.filter(c => c.scheduledFor === nextBurstTime);

  // Reschedule them to NOW
  const newTime = now + 1000; // 1 second from now
  for (const challenge of burstChallenges) {
    challenge.scheduledFor = newTime;
  }

  saveSessionData();

  console.log(`[Testing] Rescheduled ${burstChallenges.length} challenges to ${new Date(newTime).toISOString()}`);

  return {
    success: true,
    rescheduledCount: burstChallenges.length,
    newTime: new Date(newTime).toISOString(),
  };
}
