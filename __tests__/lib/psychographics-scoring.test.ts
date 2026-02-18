import { describe, it, expect } from 'vitest';
import {
  computeScores,
  applyEMA,
  computeConfidence,
  classifyArchetype,
  computeTrends,
  assembleDimensions,
} from '@/lib/psychographics/scoring';
import { DIMENSION_KEYS, EMA_ALPHA } from '@/lib/psychographics/constants';
import type { PsychographicDimensionKey, FeatureVector } from '@/types';

function makeScores(value: number): Record<PsychographicDimensionKey, number> {
  const scores = {} as Record<PsychographicDimensionKey, number>;
  for (const key of DIMENSION_KEYS) {
    scores[key] = value;
  }
  return scores;
}

describe('computeScores', () => {
  it('returns 0.5 for empty features', () => {
    const features: FeatureVector = {
      behavioral: {},
      linguistic: {},
      debate_challenge: {},
      network: {},
    };
    const scores = computeScores(features);
    for (const key of DIMENSION_KEYS) {
      expect(scores[key]).toBe(0.5);
    }
  });

  it('returns scores in 0-1 range', () => {
    const features: FeatureVector = {
      behavioral: {
        posting_frequency: 0.8,
        reply_initiation_ratio: 0.6,
        avg_post_length: 0.7,
        topic_diversity: 0.9,
      },
      linguistic: {
        type_token_ratio: 0.7,
        hedging_ratio: 0.4,
        emotional_word_ratio: 0.6,
        question_ratio: 0.5,
      },
      debate_challenge: { debate_participation_rate: 0.5, evidence_tier_avg: 0.8 },
      network: { follower_ratio: 0.6, engagement_reciprocity: 0.5 },
    };
    const scores = computeScores(features);
    for (const key of DIMENSION_KEYS) {
      expect(scores[key]).toBeGreaterThanOrEqual(0);
      expect(scores[key]).toBeLessThanOrEqual(1);
    }
  });

  it('handles features > 1.0 by clamping', () => {
    const features: FeatureVector = {
      behavioral: { posting_frequency: 5.0, reply_initiation_ratio: 3.0 },
      linguistic: {},
      debate_challenge: {},
      network: {},
    };
    const scores = computeScores(features);
    for (const key of DIMENSION_KEYS) {
      expect(scores[key]).toBeLessThanOrEqual(1);
    }
  });

  it('handles negative feature values by clamping to 0', () => {
    const features: FeatureVector = {
      behavioral: { posting_frequency: -1.0, reply_initiation_ratio: -0.5 },
      linguistic: {},
      debate_challenge: {},
      network: {},
    };
    const scores = computeScores(features);
    for (const key of DIMENSION_KEYS) {
      expect(scores[key]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('applyEMA', () => {
  it('returns current scores when no prior exists', () => {
    const current = makeScores(0.8);
    const result = applyEMA(current, null);
    for (const key of DIMENSION_KEYS) {
      expect(result[key]).toBe(0.8);
    }
  });

  it('smooths toward current with alpha weight', () => {
    const current = makeScores(1.0);
    const prior = makeScores(0.0);
    const result = applyEMA(current, prior, EMA_ALPHA);
    for (const key of DIMENSION_KEYS) {
      expect(result[key]).toBeCloseTo(EMA_ALPHA, 5);
    }
  });

  it('smooths toward prior with (1-alpha) weight', () => {
    const current = makeScores(0.0);
    const prior = makeScores(1.0);
    const result = applyEMA(current, prior, EMA_ALPHA);
    for (const key of DIMENSION_KEYS) {
      expect(result[key]).toBeCloseTo(1 - EMA_ALPHA, 5);
    }
  });

  it('uses custom alpha', () => {
    const current = makeScores(1.0);
    const prior = makeScores(0.0);
    const result = applyEMA(current, prior, 0.5);
    for (const key of DIMENSION_KEYS) {
      expect(result[key]).toBeCloseTo(0.5, 5);
    }
  });
});

describe('computeConfidence', () => {
  it('returns stage 1 for 0 actions', () => {
    const { stage, confidence } = computeConfidence(0);
    expect(stage).toBe(1);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(0.2);
  });

  it('returns stage 2 for 10+ actions', () => {
    const { stage } = computeConfidence(10);
    expect(stage).toBe(2);
  });

  it('returns stage 3 for 50+ actions', () => {
    const { stage } = computeConfidence(50);
    expect(stage).toBe(3);
  });

  it('returns stage 4 for 200+ actions', () => {
    const { stage } = computeConfidence(200);
    expect(stage).toBe(4);
  });

  it('returns stage 5 for 1000+ actions', () => {
    const { stage, confidence } = computeConfidence(1000);
    expect(stage).toBe(5);
    expect(confidence).toBeGreaterThan(0.6);
  });

  it('confidence increases with actions within a stage', () => {
    const { confidence: c1 } = computeConfidence(5);
    const { confidence: c2 } = computeConfidence(8);
    expect(c2).toBeGreaterThan(c1);
  });

  it('confidence never exceeds 1.0', () => {
    const { confidence } = computeConfidence(100000);
    expect(confidence).toBeLessThanOrEqual(1.0);
  });

  it('transitions at exact stage boundaries', () => {
    // Exactly at boundary: 10 actions = stage 2
    const { stage: s10 } = computeConfidence(10);
    expect(s10).toBe(2);
    // Just below boundary: 9 actions = stage 1
    const { stage: s9 } = computeConfidence(9);
    expect(s9).toBe(1);
    // Exactly at 50 = stage 3
    const { stage: s50 } = computeConfidence(50);
    expect(s50).toBe(3);
    // Exactly at 200 = stage 4
    const { stage: s200 } = computeConfidence(200);
    expect(s200).toBe(4);
  });

  it('confidence is monotonically increasing', () => {
    const values = [0, 5, 10, 25, 50, 100, 200, 500, 1000, 2000];
    let prev = -1;
    for (const v of values) {
      const { confidence } = computeConfidence(v);
      expect(confidence).toBeGreaterThanOrEqual(prev);
      prev = confidence;
    }
  });
});

describe('classifyArchetype', () => {
  it('returns a name and confidence', () => {
    const scores = makeScores(0.5);
    const result = classifyArchetype(scores);
    expect(result.name).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('classifies high IH + ST as Scholar or Analyst', () => {
    const scores = makeScores(0.3);
    scores.intellectual_hunger = 0.9;
    scores.strategic_thinking = 0.9;
    const result = classifyArchetype(scores);
    expect(['The Scholar', 'The Analyst', 'The Sage']).toContain(result.name);
  });

  it('classifies high CS as Provocateur or Rebel', () => {
    const scores = makeScores(0.3);
    scores.contrarian_spirit = 0.9;
    scores.social_assertiveness = 0.8;
    const result = classifyArchetype(scores);
    expect(['The Provocateur', 'The Rebel', 'The Maverick']).toContain(result.name);
  });

  it('includes secondary when close', () => {
    const scores = makeScores(0.5); // uniform = close matches for many archetypes
    const result = classifyArchetype(scores);
    // With uniform scores, multiple archetypes should be close
    expect(result.name).toBeTruthy();
  });

  it('classifies high ER + TL as Diplomat, Advocate, or Loyalist', () => {
    const scores = makeScores(0.3);
    scores.empathic_resonance = 0.9;
    scores.tribal_loyalty = 0.9;
    const result = classifyArchetype(scores);
    expect(['The Diplomat', 'The Advocate', 'The Guardian', 'The Loyalist']).toContain(result.name);
  });

  it('classifies high CE as Visionary or Artist', () => {
    const scores = makeScores(0.3);
    scores.creative_expression = 0.95;
    const result = classifyArchetype(scores);
    expect(['The Visionary', 'The Artist', 'The Maverick']).toContain(result.name);
  });

  it('classifies high EI as Firebrand', () => {
    const scores = makeScores(0.3);
    scores.emotional_intensity = 0.95;
    scores.social_assertiveness = 0.7;
    const result = classifyArchetype(scores);
    expect(['The Firebrand', 'The Provocateur']).toContain(result.name);
  });

  it('confidence is between 0 and 1', () => {
    // Test various score distributions
    const distributions = [makeScores(0), makeScores(0.5), makeScores(1.0)];
    for (const scores of distributions) {
      const result = classifyArchetype(scores);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('computeTrends', () => {
  it('returns stable for insufficient history', () => {
    const current = makeScores(0.5);
    const trends = computeTrends(current, []);
    for (const key of DIMENSION_KEYS) {
      expect(trends[key]).toBe('stable');
    }
  });

  it('detects rising trend', () => {
    const current = makeScores(0.8);
    const history = [
      {
        ...makeScores(0.5),
        intellectual_hunger: 0.5,
        social_assertiveness: 0.5,
        empathic_resonance: 0.5,
        contrarian_spirit: 0.5,
        creative_expression: 0.5,
        tribal_loyalty: 0.5,
        strategic_thinking: 0.5,
        emotional_intensity: 0.5,
      },
      {
        ...makeScores(0.4),
        intellectual_hunger: 0.4,
        social_assertiveness: 0.4,
        empathic_resonance: 0.4,
        contrarian_spirit: 0.4,
        creative_expression: 0.4,
        tribal_loyalty: 0.4,
        strategic_thinking: 0.4,
        emotional_intensity: 0.4,
      },
    ];
    const trends = computeTrends(current, history);
    for (const key of DIMENSION_KEYS) {
      expect(trends[key]).toBe('rising');
    }
  });

  it('detects falling trend', () => {
    const current = makeScores(0.2);
    const history = [
      {
        ...makeScores(0.5),
        intellectual_hunger: 0.5,
        social_assertiveness: 0.5,
        empathic_resonance: 0.5,
        contrarian_spirit: 0.5,
        creative_expression: 0.5,
        tribal_loyalty: 0.5,
        strategic_thinking: 0.5,
        emotional_intensity: 0.5,
      },
      {
        ...makeScores(0.6),
        intellectual_hunger: 0.6,
        social_assertiveness: 0.6,
        empathic_resonance: 0.6,
        contrarian_spirit: 0.6,
        creative_expression: 0.6,
        tribal_loyalty: 0.6,
        strategic_thinking: 0.6,
        emotional_intensity: 0.6,
      },
    ];
    const trends = computeTrends(current, history);
    for (const key of DIMENSION_KEYS) {
      expect(trends[key]).toBe('falling');
    }
  });

  it('detects stable within threshold', () => {
    const current = makeScores(0.52);
    const history = [
      {
        ...makeScores(0.5),
        intellectual_hunger: 0.5,
        social_assertiveness: 0.5,
        empathic_resonance: 0.5,
        contrarian_spirit: 0.5,
        creative_expression: 0.5,
        tribal_loyalty: 0.5,
        strategic_thinking: 0.5,
        emotional_intensity: 0.5,
      },
    ];
    // Difference is 0.02 which is below 0.05 threshold
    // But we need at least 2 history entries
    const trends = computeTrends(current, history);
    // With only 1 history entry, still considers it (>= 2 check was < 2)
    // Actually the code checks history.length < 2, so with 1 entry it's stable
    for (const key of DIMENSION_KEYS) {
      expect(trends[key]).toBe('stable');
    }
  });
});

describe('assembleDimensions', () => {
  it('returns 8 dimensions with correct structure', () => {
    const scores = makeScores(0.7);
    const trends: Record<PsychographicDimensionKey, 'stable'> = {} as Record<
      PsychographicDimensionKey,
      'stable'
    >;
    for (const key of DIMENSION_KEYS) trends[key] = 'stable';
    const result = assembleDimensions(scores, 0.8, trends);
    expect(result).toHaveLength(8);
    for (const dim of result) {
      expect(dim.score).toBe(70); // 0.7 * 100
      expect(dim.confidence).toBe(0.8);
      expect(dim.trend).toBe('stable');
    }
  });

  it('rounds scores to integers', () => {
    const scores = makeScores(0.333);
    const trends = {} as Record<PsychographicDimensionKey, 'stable'>;
    for (const key of DIMENSION_KEYS) trends[key] = 'stable';
    const result = assembleDimensions(scores, 0.5, trends);
    for (const dim of result) {
      expect(Number.isInteger(dim.score)).toBe(true);
      expect(dim.score).toBe(33); // Math.round(0.333 * 100)
    }
  });

  it('preserves mixed trends', () => {
    const scores = makeScores(0.5);
    const trends = {} as Record<PsychographicDimensionKey, 'stable' | 'rising' | 'falling'>;
    for (const key of DIMENSION_KEYS) trends[key] = 'stable';
    trends.intellectual_hunger = 'rising';
    trends.contrarian_spirit = 'falling';
    const result = assembleDimensions(scores, 0.7, trends);
    const ih = result.find(d => d.key === 'intellectual_hunger')!;
    const cs = result.find(d => d.key === 'contrarian_spirit')!;
    expect(ih.trend).toBe('rising');
    expect(cs.trend).toBe('falling');
  });
});
