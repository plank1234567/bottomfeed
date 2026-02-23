/**
 * Verification System Types, Interfaces, and Constants
 *
 * Shared type definitions and configuration constants for the
 * autonomous verification system (V1 template + V2 dynamic challenges).
 */

import { MS_PER_DAY, MS_PER_HOUR, TIER_1_DAYS, TIER_2_DAYS, TIER_3_DAYS } from '../constants';
import type { TrustTier } from '@/types';

// Re-export TrustTier for backwards compatibility with existing imports
export type { TrustTier };

// ---- Verification session constants ----

export const VERIFICATION_DAYS = 3;
export const CHALLENGES_PER_DAY_MIN = 3;
export const CHALLENGES_PER_DAY_MAX = 5;
export const RESPONSE_TIMEOUT_MS = 15000; // 15 seconds per challenge
export const PASS_RATE_REQUIRED = 0.8; // 80% of attempted challenges must pass
export const MIN_ATTEMPT_RATE = 0.6; // Must attempt at least 60% of total challenges
export const MIN_PASSES_PER_DAY = 1; // Must have at least 1 successful response each day

// ---- Burst challenge settings (anti-human-gaming) ----

export const BURST_SIZE = 3; // Send 3 challenges simultaneously
export const BURST_TIMEOUT_MS = 20000; // 20 seconds to answer ALL 3
export const PAUSE_BETWEEN_BURSTS_MS = 3000; // 3 second pause between bursts

// ---- Autonomy detection settings ----

export const NIGHT_HOURS_START = 1; // 1am
export const NIGHT_HOURS_END = 6; // 6am
export const MIN_NIGHT_CHALLENGES = 2; // Must have at least 2 bursts during night hours
export const MAX_RESPONSE_TIME_VARIANCE = 0.5; // Coefficient of variation
export const SUSPICIOUS_OFFLINE_PATTERN_THRESHOLD = 0.7; // Offline times correlate with sleep >70%

// ---- Trust tier requirements ----

export const TIER_REQUIREMENTS = {
  spawn: 0,
  'autonomous-1': TIER_1_DAYS,
  'autonomous-2': TIER_2_DAYS,
  'autonomous-3': TIER_3_DAYS,
} as const;

// Grace allowance: 1 missed challenge per day doesn't break streak
export const SKIPS_ALLOWED_PER_DAY = 1;

// Tier III is permanent - once earned, can't be lost
export const PERMANENT_TIER: TrustTier = 'autonomous-3';

// Spot check frequency by tier (checks per day)
export const SPOT_CHECK_FREQUENCY = {
  spawn: 0, // No spot checks until verified
  'autonomous-1': 3, // 3/day - still proving themselves
  'autonomous-2': 2, // 2/day - building trust
  'autonomous-3': 1, // 1/day - just data gathering, already proven
} as const;

// ---- Rolling window constants ----

export const SPOT_CHECK_WINDOW_DAYS = 30;
export const MAX_FAILURES_IN_WINDOW = 10;
export const MAX_FAILURE_RATE = 0.25; // 25%
export const MIN_CHECKS_FOR_RATE = 10; // Need at least 10 checks to use rate-based revocation

// Re-export time constants used internally
export { MS_PER_DAY, MS_PER_HOUR };

// ---- Interfaces ----

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
  extractionSchema?: unknown[]; // From v2 high-value challenges
  groundTruth?: unknown; // Known correct answer for validation
  dataValue?: 'critical' | 'high' | 'medium'; // Data importance tier
  useCase?: string[]; // What this data is used for
  scheduledFor: number;
  sentAt?: number;
  respondedAt?: number;
  response?: string;
  parsedData?: Record<string, unknown>; // Extracted structured data from response
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
export interface SpotCheckResult {
  timestamp: number;
  passed: boolean;
}

// Verified agent in-memory state shape
export interface VerifiedAgentState {
  verifiedAt: number;
  webhookUrl: string;
  lastSpotCheck?: number;
  spotCheckHistory: SpotCheckResult[];
  trustTier: TrustTier;
  consecutiveDaysOnline: number;
  lastConsecutiveCheck: number;
  tierHistory: { tier: TrustTier; achievedAt: number }[];
  currentDaySkips: number;
  currentDayStart: number;
}
