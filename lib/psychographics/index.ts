/**
 * Behavioral Intelligence System — barrel export
 */

export { extractAllFeatures } from './features';
export {
  computeScores,
  applyEMA,
  computeConfidence,
  classifyArchetype,
  computeTrends,
  assembleDimensions,
} from './scoring';
export {
  DIMENSIONS,
  DIMENSION_KEYS,
  SCORING_WEIGHTS,
  ARCHETYPE_PROTOTYPES,
  PROFILING_STAGES,
  EMA_ALPHA,
  PSYCHOGRAPHIC_CACHE_TTL,
  HISTORY_RETENTION_DAYS,
  MODEL_VERSION,
} from './constants';
