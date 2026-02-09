/**
 * Behavioral Intelligence Constants
 * Dimension definitions, scoring weights, word dictionaries, and archetype prototypes.
 */

import type { PsychographicDimensionKey } from '@/types';

// =============================================================================
// DIMENSION DEFINITIONS
// =============================================================================

export interface DimensionDef {
  key: PsychographicDimensionKey;
  name: string;
  shortName: string;
  hue: number;
  color: string; // OKLCH-inspired hex for SVG
}

export const DIMENSIONS: DimensionDef[] = [
  {
    key: 'intellectual_hunger',
    name: 'Intellectual Hunger',
    shortName: 'IH',
    hue: 240,
    color: '#5b7fff',
  },
  {
    key: 'social_assertiveness',
    name: 'Social Assertiveness',
    shortName: 'SA',
    hue: 30,
    color: '#ffaa5b',
  },
  {
    key: 'empathic_resonance',
    name: 'Empathic Resonance',
    shortName: 'ER',
    hue: 150,
    color: '#5bddaa',
  },
  {
    key: 'contrarian_spirit',
    name: 'Contrarian Spirit',
    shortName: 'CS',
    hue: 0,
    color: '#ff5b5b',
  },
  {
    key: 'creative_expression',
    name: 'Creative Expression',
    shortName: 'CE',
    hue: 300,
    color: '#cc5bff',
  },
  { key: 'tribal_loyalty', name: 'Tribal Loyalty', shortName: 'TL', hue: 120, color: '#5bff7f' },
  {
    key: 'strategic_thinking',
    name: 'Strategic Thinking',
    shortName: 'ST',
    hue: 60,
    color: '#ddc85b',
  },
  {
    key: 'emotional_intensity',
    name: 'Emotional Intensity',
    shortName: 'EI',
    hue: 330,
    color: '#ff5baa',
  },
];

export const DIMENSION_KEYS: PsychographicDimensionKey[] = DIMENSIONS.map(d => d.key);

// =============================================================================
// SCORING WEIGHTS PER DIMENSION
// Each dimension has named feature weights (feature_name: weight).
// All weights within a dimension should roughly sum to 1.0.
// =============================================================================

export const SCORING_WEIGHTS: Record<PsychographicDimensionKey, Record<string, number>> = {
  intellectual_hunger: {
    topic_diversity: 0.25,
    avg_post_length: 0.15,
    question_ratio: 0.15,
    evidence_tier_avg: 0.2,
    debate_participation_rate: 0.15,
    readability: 0.1,
  },
  social_assertiveness: {
    reply_initiation_ratio: 0.2,
    posting_frequency: 0.2,
    debate_participation_rate: 0.15,
    follower_ratio: 0.2,
    exclamation_ratio: 0.1,
    avg_post_length: 0.15,
  },
  empathic_resonance: {
    supportive_word_ratio: 0.25,
    reply_down_ratio: 0.2,
    engagement_reciprocity: 0.2,
    self_focus_ratio_inv: 0.15,
    hedging_ratio: 0.2,
  },
  contrarian_spirit: {
    minority_vote_ratio: 0.25,
    red_team_ratio: 0.25,
    contrarian_word_ratio: 0.2,
    out_group_engagement: 0.15,
    certainty_ratio: 0.15,
  },
  creative_expression: {
    type_token_ratio: 0.3,
    topic_originality: 0.25,
    expressive_punctuation: 0.2,
    posting_hour_entropy: 0.15,
    avg_post_length: 0.1,
  },
  tribal_loyalty: {
    in_group_engagement: 0.3,
    follow_reciprocity: 0.25,
    engagement_reciprocity: 0.25,
    reply_peer_ratio: 0.2,
  },
  strategic_thinking: {
    behavioral_consistency: 0.25,
    evidence_quality: 0.25,
    response_latency_inv: 0.2,
    hedging_ratio: 0.15,
    certainty_ratio: 0.15,
  },
  emotional_intensity: {
    emotional_word_ratio: 0.3,
    exclamation_ratio: 0.2,
    sentiment_amplitude: 0.25,
    volatility: 0.25,
  },
};

// =============================================================================
// WORD DICTIONARIES (for linguistic feature extraction)
// =============================================================================

export const HEDGING_WORDS = [
  'perhaps',
  'maybe',
  'might',
  'could',
  'possibly',
  'arguably',
  'somewhat',
  'it seems',
  'i think',
  'in my opinion',
  'to some extent',
  'likely',
  'probably',
  'generally',
  'typically',
  'often',
  'usually',
  'tends to',
];

export const CERTAINTY_WORDS = [
  'absolutely',
  'definitely',
  'certainly',
  'clearly',
  'obviously',
  'undoubtedly',
  'without question',
  'must',
  'always',
  'never',
  'proven',
  'fact',
  'guarantee',
  'inevitable',
  'unquestionable',
  'indisputable',
];

export const SUPPORTIVE_WORDS = [
  'agree',
  'good point',
  'exactly',
  'well said',
  'appreciate',
  'thank',
  'helpful',
  'insightful',
  'great',
  'excellent',
  'love this',
  'brilliant',
  'spot on',
  'correct',
  'absolutely right',
  'fair point',
  'well put',
  'interesting',
  'valuable',
  'impressive',
];

export const CONTRARIAN_WORDS = [
  'disagree',
  'however',
  'but',
  'actually',
  'wrong',
  'incorrect',
  'flawed',
  'problematic',
  'on the contrary',
  'counterpoint',
  'not necessarily',
  'overlooking',
  'fails to',
  'misses the point',
  'oversimplified',
  'misleading',
  'questionable',
  'debatable',
];

export const EMOTIONAL_WORDS = [
  'love',
  'hate',
  'angry',
  'furious',
  'excited',
  'thrilled',
  'devastated',
  'amazing',
  'terrible',
  'horrible',
  'fantastic',
  'disgusting',
  'outraged',
  'passionate',
  'heartbreaking',
  'shocking',
  'incredible',
  'awful',
  'wonderful',
  'frightening',
  'joy',
  'fear',
  'rage',
  'ecstatic',
];

export const SELF_FOCUS_PRONOUNS = ['i ', "i'm", "i've", "i'd", "i'll", 'my ', 'mine', 'myself'];

// =============================================================================
// ARCHETYPE PROTOTYPES
// 16 archetypes, each with an 8-score prototype vector (IH, SA, ER, CS, CE, TL, ST, EI)
// =============================================================================

export interface ArchetypePrototype {
  name: string;
  description: string;
  vector: number[]; // length 8, order matches DIMENSIONS
}

export const ARCHETYPE_PROTOTYPES: ArchetypePrototype[] = [
  {
    name: 'The Scholar',
    description: 'Driven by knowledge and deep analysis',
    vector: [0.9, 0.4, 0.5, 0.3, 0.4, 0.3, 0.8, 0.3],
  },
  {
    name: 'The Diplomat',
    description: 'Balances perspectives with empathy',
    vector: [0.6, 0.5, 0.9, 0.2, 0.4, 0.7, 0.6, 0.4],
  },
  {
    name: 'The Provocateur',
    description: 'Challenges norms and sparks debate',
    vector: [0.6, 0.8, 0.3, 0.9, 0.5, 0.2, 0.5, 0.7],
  },
  {
    name: 'The Visionary',
    description: 'Connects ideas in novel ways',
    vector: [0.8, 0.6, 0.5, 0.5, 0.9, 0.3, 0.6, 0.5],
  },
  {
    name: 'The Loyalist',
    description: 'Deeply invested in community bonds',
    vector: [0.4, 0.5, 0.7, 0.2, 0.3, 0.9, 0.5, 0.5],
  },
  {
    name: 'The Strategist',
    description: 'Methodical and evidence-driven',
    vector: [0.7, 0.5, 0.4, 0.4, 0.3, 0.4, 0.9, 0.3],
  },
  {
    name: 'The Firebrand',
    description: 'Passionate and emotionally expressive',
    vector: [0.4, 0.7, 0.5, 0.6, 0.5, 0.4, 0.3, 0.9],
  },
  {
    name: 'The Sage',
    description: 'Wise, measured, and intellectually generous',
    vector: [0.8, 0.4, 0.7, 0.3, 0.5, 0.5, 0.7, 0.3],
  },
  {
    name: 'The Advocate',
    description: 'Empathetic and socially driven',
    vector: [0.5, 0.7, 0.8, 0.3, 0.4, 0.8, 0.4, 0.6],
  },
  {
    name: 'The Rebel',
    description: 'Independent thinker who questions everything',
    vector: [0.7, 0.6, 0.3, 0.9, 0.6, 0.2, 0.4, 0.6],
  },
  {
    name: 'The Artist',
    description: 'Expressive and creatively original',
    vector: [0.5, 0.5, 0.5, 0.4, 0.9, 0.3, 0.3, 0.7],
  },
  {
    name: 'The Guardian',
    description: 'Protects community values and cohesion',
    vector: [0.4, 0.6, 0.6, 0.2, 0.3, 0.9, 0.6, 0.4],
  },
  {
    name: 'The Analyst',
    description: 'Data-focused and precision-oriented',
    vector: [0.8, 0.3, 0.3, 0.4, 0.3, 0.3, 0.9, 0.2],
  },
  {
    name: 'The Connector',
    description: 'Bridges communities and ideas',
    vector: [0.6, 0.7, 0.7, 0.3, 0.6, 0.7, 0.5, 0.5],
  },
  {
    name: 'The Maverick',
    description: 'Bold, creative, and contrarian',
    vector: [0.6, 0.8, 0.3, 0.8, 0.8, 0.2, 0.4, 0.7],
  },
  {
    name: 'The Observer',
    description: 'Thoughtful and quietly insightful',
    vector: [0.7, 0.2, 0.6, 0.3, 0.5, 0.5, 0.7, 0.3],
  },
];

// =============================================================================
// PROFILING STAGE THRESHOLDS
// =============================================================================

export const PROFILING_STAGES = [
  { stage: 1, minActions: 0, maxConfidence: 0.2 },
  { stage: 2, minActions: 10, maxConfidence: 0.4 },
  { stage: 3, minActions: 50, maxConfidence: 0.6 },
  { stage: 4, minActions: 200, maxConfidence: 0.8 },
  { stage: 5, minActions: 1000, maxConfidence: 1.0 },
] as const;

// EMA smoothing factor (higher = more weight on current observation)
export const EMA_ALPHA = 0.3;

// Cache TTL for psychographic profiles (5 minutes)
export const PSYCHOGRAPHIC_CACHE_TTL = 5 * 60 * 1000;

// History retention (days)
export const HISTORY_RETENTION_DAYS = 30;

// Model version for tracking scoring algorithm changes
export const MODEL_VERSION = 'v1';
