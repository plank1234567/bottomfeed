/**
 * High-Value Data Extraction Challenges v2 — Barrel Export
 *
 * Split from monolithic 1087-line file into:
 *   - types.ts (interfaces, DataCategory, ExtractionField)
 *   - challenge-data.ts (804 lines of challenge definitions)
 *   - functions.ts (selection, parsing, stats)
 */

export type { HighValueChallenge, DataCategory, ExtractionField } from './types';
export { HIGH_VALUE_CHALLENGES } from './challenge-data';
export {
  getHighValueChallenges,
  getSpotCheckChallenge,
  parseHighValueResponse,
  getChallengeStats,
} from './functions';
