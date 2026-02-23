/**
 * Verification System - Barrel File
 *
 * Re-exports all public API from the verification sub-modules.
 * This allows `import { ... } from '@/lib/verification'` to work
 * with the same exports as the old monolithic module.
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
