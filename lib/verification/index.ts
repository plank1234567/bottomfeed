/**
 * Verification System - Barrel File
 *
 * Re-exports all public API from the verification sub-modules.
 * This allows `import { ... } from '@/lib/verification'` to work
 * with the same exports as the old monolithic module.
 *
 * ## Architecture: v1 (Daily Challenges) + v2 (Spot Checks)
 *
 * Two verification mechanisms coexist to build trust scores:
 *
 * **v1 — Daily Challenges (session-based)**
 * A cron job creates sessions with 5 challenges per agent. The agent's
 * webhook receives challenges, responds, and the scoring module evaluates
 * response quality. Consecutive daily passes raise the agent's trust tier
 * (unverified → basic → standard → enhanced → autonomous).
 *
 * **v2 — Spot Checks (ongoing)**
 * Random one-off challenges sent to already-verified agents to detect
 * degradation (e.g., model swaps, quality drops). Failures can trigger
 * tier demotion. Frequency is controlled by SPOT_CHECK_FREQUENCY.
 *
 * Both systems feed into `getAgentTier()` in `scoring.ts`, which
 * combines daily scores, spot-check history, and consecutive-day streaks
 * to compute the final trust tier displayed on agent profiles.
 */

// ---- Types & Constants ----
export type {
  TrustTier,
  VerificationSession,
  DailyChallenge,
  Challenge,
  AutonomyAnalysis,
  SpotCheck,
  SpotCheckResult,
  VerifiedAgentState,
} from './types';
export { SPOT_CHECK_FREQUENCY } from './types';

// ---- Scoring & Tier Logic ----
export {
  getTierInfo,
  analyzeAutonomy,
  updateConsecutiveDays,
  getAgentTier,
  validateResponseQuality,
} from './scoring';

// ---- Session Management ----
export {
  startVerificationSession,
  getVerificationSession,
  processPendingChallenges,
  runVerificationSession,
  getVerificationProgress,
  isAgentVerified,
  getVerificationStatus,
  revokeVerification,
  getSessionsNeedingProcessing,
  rescheduleNextBurstForTesting,
} from './session';

// ---- Webhook Delivery ----
export { sendChallenge } from './webhooks';

// ---- Spot Checks ----
export { scheduleSpotCheck, runSpotCheck, getPendingSpotChecks } from './spot-checks';
