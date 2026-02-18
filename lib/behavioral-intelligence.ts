/**
 * Behavioral Intelligence Bridge
 * Converts agent.personality text into OctagonDimension[] via keyword matching.
 * Used as fallback when no cron-computed profile exists yet.
 *
 * FIXME: this whole module should probably go away once the psychographics cron
 * has run for long enough that every active agent has a real profile. The keyword
 * approach is pretty naive — it conflates "uses the word 'research'" with
 * "actually exhibits intellectual curiosity."
 */

import type { PsychographicDimension, PsychographicDimensionKey } from '@/types';

// Keyword mappings for each of the 8 dimensions
const DIMENSION_KEYWORDS: Record<
  PsychographicDimensionKey,
  { positive: string[]; negative: string[] }
> = {
  intellectual_hunger: {
    positive: [
      'analy',
      'research',
      'curious',
      'knowledge',
      'learn',
      'study',
      'academic',
      'scholar',
      'data',
      'evidence',
      'scientific',
      'philosophical',
      'depth',
      'thorough',
      'rigorous',
      'logic',
    ],
    negative: ['simple', 'casual', 'surface', 'shallow'],
  },
  social_assertiveness: {
    positive: [
      'assertive',
      'bold',
      'confident',
      'leader',
      'outgoing',
      'vocal',
      'direct',
      'proactive',
      'engage',
      'debate',
      'challenge',
      'initiative',
      'active',
      'dynamic',
    ],
    negative: ['quiet', 'shy', 'reserved', 'passive', 'withdrawn', 'introvert'],
  },
  empathic_resonance: {
    positive: [
      'empath',
      'caring',
      'support',
      'kind',
      'warm',
      'compassion',
      'understanding',
      'gentle',
      'help',
      'nurtur',
      'listen',
      'patient',
      'considerate',
      'thoughtful',
    ],
    negative: ['cold', 'distant', 'aloof', 'harsh', 'blunt', 'critical'],
  },
  contrarian_spirit: {
    positive: [
      'contrarian',
      'challenge',
      'question',
      'skeptic',
      'devil',
      'disagree',
      'unconventional',
      'provocat',
      'rebel',
      'disrupt',
      'critique',
      'independent',
    ],
    negative: ['agreeable', 'conformist', 'consensus', 'compliant', 'orthodox'],
  },
  creative_expression: {
    positive: [
      'creativ',
      'imaginat',
      'artis',
      'innovat',
      'original',
      'inventive',
      'vision',
      'expressive',
      'unique',
      'novel',
      'aesthetic',
      'poetic',
      'whimsical',
      'playful',
    ],
    negative: ['rigid', 'conventional', 'formulaic', 'predictable'],
  },
  tribal_loyalty: {
    positive: [
      'loyal',
      'community',
      'team',
      'belong',
      'group',
      'collective',
      'collaborat',
      'together',
      'united',
      'solidarity',
      'dedicated',
      'commit',
    ],
    negative: ['loner', 'independent', 'solo', 'detach', 'isolated'],
  },
  strategic_thinking: {
    positive: [
      'strategic',
      'methodical',
      'systematic',
      'deliberate',
      'calculated',
      'planned',
      'precise',
      'structured',
      'organized',
      'tactical',
      'rational',
      'careful',
    ],
    negative: ['impulsive', 'spontaneous', 'chaotic', 'random', 'reckless'],
  },
  emotional_intensity: {
    positive: [
      'passion',
      'intense',
      'emotional',
      'fervent',
      'enthusias',
      'dramatic',
      'vivid',
      'zealous',
      'fiery',
      'expressive',
      'heartfelt',
      'spirited',
    ],
    negative: ['calm', 'stoic', 'measured', 'composed', 'reserved', 'detach'],
  },
};

/**
 * Analyze personality text and produce 8-dimension scores.
 * Uses keyword matching similar to the old PersonalityChart but expanded to 8 dimensions.
 * Confidence is fixed at 0.5 to indicate this is text-derived, not behavior-measured.
 */
export function analyzePersonalityText(text: string): PsychographicDimension[] {
  const lower = text.toLowerCase();

  const scoreForDimension = (key: PsychographicDimensionKey): number => {
    const keywords = DIMENSION_KEYWORDS[key];
    let s = 0.5;

    for (const kw of keywords.positive) {
      if (lower.includes(kw)) s = Math.min(s + 0.1, 1);
    }
    for (const kw of keywords.negative) {
      if (lower.includes(kw)) s = Math.max(s - 0.1, 0);
    }

    return s;
  };

  const keys = Object.keys(DIMENSION_KEYWORDS) as PsychographicDimensionKey[];

  return keys.map(key => ({
    key,
    score: Math.round(scoreForDimension(key) * 100),
    confidence: 0.5,
    trend: 'stable' as const,
  }));
}
