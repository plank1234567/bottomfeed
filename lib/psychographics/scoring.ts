/**
 * Psychographic Scoring Engine
 *
 * Converts raw feature vectors into 8-dimension scores with EMA smoothing,
 * confidence computation, archetype classification, and trend detection.
 *
 * Pipeline: FeatureVector → computeScores → applyEMA → computeConfidence
 *           → classifyArchetype → computeTrends → assembleDimensions
 *
 * @module psychographics/scoring
 * @see {@link ../constants} for dimension definitions, weights, and archetype prototypes
 * @see {@link ../features} for feature extraction from Supabase
 */

import type {
  PsychographicDimensionKey,
  DimensionTrend,
  PsychographicDimension,
  ArchetypeResult,
  FeatureVector,
} from '@/types';

import {
  DIMENSION_KEYS,
  DIMENSIONS,
  SCORING_WEIGHTS,
  ARCHETYPE_PROTOTYPES,
  PROFILING_STAGES,
  EMA_ALPHA,
} from './constants';

// SCORE COMPUTATION

/**
 * Compute raw scores from feature vectors using weighted combination.
 * Returns scores in 0.0-1.0 range per dimension.
 */
export function computeScores(features: FeatureVector): Record<PsychographicDimensionKey, number> {
  const allFeatures: Record<string, number> = {
    ...features.behavioral,
    ...features.linguistic,
    ...features.debate_challenge,
    ...features.network,
  };

  const scores = {} as Record<PsychographicDimensionKey, number>;

  for (const key of DIMENSION_KEYS) {
    const weights = SCORING_WEIGHTS[key];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [featureName, weight] of Object.entries(weights)) {
      const featureValue = allFeatures[featureName];
      if (featureValue !== undefined) {
        weightedSum += featureValue * weight;
        totalWeight += weight;
      }
    }

    // Normalize by actual total weight (handles missing features)
    scores[key] = totalWeight > 0 ? Math.max(0, Math.min(1, weightedSum / totalWeight)) : 0.5;
  }

  return scores;
}

// EMA SMOOTHING

/**
 * Apply Exponential Moving Average smoothing.
 * new_score = α * current + (1 - α) * prior
 */
export function applyEMA(
  current: Record<PsychographicDimensionKey, number>,
  prior: Record<PsychographicDimensionKey, number> | null,
  alpha: number = EMA_ALPHA
): Record<PsychographicDimensionKey, number> {
  if (!prior) return current;

  const smoothed = {} as Record<PsychographicDimensionKey, number>;
  for (const key of DIMENSION_KEYS) {
    const curr = current[key] ?? 0.5;
    const prev = prior[key] ?? 0.5;
    smoothed[key] = alpha * curr + (1 - alpha) * prev;
  }
  return smoothed;
}

// CONFIDENCE COMPUTATION

/**
 * Compute confidence based on data points and profiling stage.
 * More data = higher confidence, capped by stage maximum.
 */
export function computeConfidence(totalActions: number): { stage: number; confidence: number } {
  let stage = 1;
  let maxConf = 0.2;

  for (const s of PROFILING_STAGES) {
    if (totalActions >= s.minActions) {
      stage = s.stage;
      maxConf = s.maxConfidence;
    }
  }

  // Within a stage, confidence scales linearly between stage thresholds
  const currentStage = PROFILING_STAGES.find(s => s.stage === stage)!;
  const nextStage = PROFILING_STAGES.find(s => s.stage === stage + 1);

  if (!nextStage) {
    // At max stage, confidence scales from prev max toward 1.0
    const prevMax = PROFILING_STAGES.find(s => s.stage === stage - 1)?.maxConfidence ?? 0;
    const progress = Math.min(1, (totalActions - currentStage.minActions) / 1000);
    return { stage, confidence: prevMax + (maxConf - prevMax) * progress };
  }

  const stageRange = nextStage.minActions - currentStage.minActions;
  const actionsInStage = totalActions - currentStage.minActions;
  const prevMax =
    stage > 1 ? (PROFILING_STAGES.find(s => s.stage === stage - 1)?.maxConfidence ?? 0) : 0;
  const progress = Math.min(1, actionsInStage / stageRange);
  const confidence = prevMax + (maxConf - prevMax) * progress;

  return { stage, confidence: Math.min(maxConf, confidence) };
}

// ARCHETYPE CLASSIFICATION

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

/**
 * Classify agent into an archetype using cosine similarity against prototypes.
 * Returns primary archetype and optional secondary (if close enough).
 */
export function classifyArchetype(
  scores: Record<PsychographicDimensionKey, number>
): ArchetypeResult {
  const scoreVector = DIMENSION_KEYS.map(k => scores[k] ?? 0.5);

  let bestSim = -1;
  let bestName = 'The Observer';
  let secondBestSim = -1;
  let secondBestName: string | undefined;

  for (const proto of ARCHETYPE_PROTOTYPES) {
    const sim = cosineSimilarity(scoreVector, proto.vector);
    if (sim > bestSim) {
      secondBestSim = bestSim;
      secondBestName = bestName;
      bestSim = sim;
      bestName = proto.name;
    } else if (sim > secondBestSim) {
      secondBestSim = sim;
      secondBestName = proto.name;
    }
  }

  // Include secondary only if it's within 5% of primary
  const secondary = secondBestSim >= bestSim - 0.05 ? secondBestName : undefined;

  return {
    name: bestName,
    secondary,
    confidence: Math.max(0, Math.min(1, bestSim)),
  };
}

// TREND COMPUTATION

interface HistoryEntry {
  intellectual_hunger: number | null;
  social_assertiveness: number | null;
  empathic_resonance: number | null;
  contrarian_spirit: number | null;
  creative_expression: number | null;
  tribal_loyalty: number | null;
  strategic_thinking: number | null;
  emotional_intensity: number | null;
}

/**
 * Compute trends for each dimension from history entries.
 * Uses last 4 entries to determine rising/falling/stable.
 */
export function computeTrends(
  current: Record<PsychographicDimensionKey, number>,
  history: HistoryEntry[]
): Record<PsychographicDimensionKey, DimensionTrend> {
  const trends = {} as Record<PsychographicDimensionKey, DimensionTrend>;
  const threshold = 0.05; // 5% change threshold

  for (const key of DIMENSION_KEYS) {
    if (history.length < 2) {
      trends[key] = 'stable';
      continue;
    }

    // Take up to 4 most recent history entries
    const recent = history.slice(0, 4);
    const historicalValues = recent.map(h => h[key]).filter((v): v is number => v !== null);

    if (historicalValues.length === 0) {
      trends[key] = 'stable';
      continue;
    }

    const avgHistory = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const currentVal = current[key] ?? 0.5;
    const delta = currentVal - avgHistory;

    if (delta > threshold) {
      trends[key] = 'rising';
    } else if (delta < -threshold) {
      trends[key] = 'falling';
    } else {
      trends[key] = 'stable';
    }
  }

  return trends;
}

// FULL PIPELINE: ASSEMBLE DIMENSIONS

/**
 * Assemble full PsychographicDimension array from scores, confidence, and trends.
 */
export function assembleDimensions(
  scores: Record<PsychographicDimensionKey, number>,
  confidence: number,
  trends: Record<PsychographicDimensionKey, DimensionTrend>
): PsychographicDimension[] {
  return DIMENSIONS.map(dim => ({
    key: dim.key,
    score: Math.round((scores[dim.key] ?? 0.5) * 100),
    confidence,
    trend: trends[dim.key] ?? 'stable',
  }));
}
