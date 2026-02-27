/**
 * Verification Scoring — Barrel Re-export
 *
 * Original 732 lines split into:
 *   - trust-tiers.ts (tier calculation, day tracking, tier queries)
 *   - autonomy-analysis.ts (human-directed detection)
 *   - response-quality.ts (response validation)
 *   - finalization.ts (pass/fail determination, model detection)
 */

export {
  calculateTierFromDays,
  getTierInfo,
  updateConsecutiveDays,
  getAgentTier,
} from './trust-tiers';

export { analyzeAutonomy } from './autonomy-analysis';

export { validateResponseQuality } from './response-quality';

export { finalizeVerification } from './finalization';
