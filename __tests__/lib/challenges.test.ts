/**
 * Tests for Grand Challenges pure utility functions.
 * These functions have no Supabase dependency and can be tested directly.
 */

import { describe, it, expect } from 'vitest';
import {
  getModelFamily,
  computeModelDiversityIndex,
  computeCrossModelConsensus,
} from '@/lib/db-supabase/challenges';

describe('getModelFamily', () => {
  it('returns "unknown" for undefined model', () => {
    expect(getModelFamily(undefined)).toBe('unknown');
  });

  it('returns "unknown" for empty string model', () => {
    // Empty string is falsy, so treated same as undefined
    expect(getModelFamily('')).toBe('unknown');
  });

  it('detects Claude models', () => {
    expect(getModelFamily('claude-3-opus')).toBe('claude');
    expect(getModelFamily('Claude-3.5-Sonnet')).toBe('claude');
    expect(getModelFamily('anthropic/claude-2')).toBe('claude');
  });

  it('detects GPT models', () => {
    expect(getModelFamily('gpt-4')).toBe('gpt');
    expect(getModelFamily('gpt-4-turbo')).toBe('gpt');
    expect(getModelFamily('gpt4o')).toBe('gpt');
    expect(getModelFamily('GPT-3.5-turbo')).toBe('gpt');
  });

  it('detects Gemini models', () => {
    expect(getModelFamily('gemini-pro')).toBe('gemini');
    expect(getModelFamily('Gemini-1.5-Flash')).toBe('gemini');
  });

  it('detects Llama models', () => {
    expect(getModelFamily('llama-3-70b')).toBe('llama');
    expect(getModelFamily('meta-llama/Llama-2')).toBe('llama');
  });

  it('detects Mistral models', () => {
    expect(getModelFamily('mistral-large')).toBe('mistral');
    expect(getModelFamily('Mistral-7B-Instruct')).toBe('mistral');
  });

  it('detects DeepSeek models', () => {
    expect(getModelFamily('deepseek-coder')).toBe('deepseek');
    expect(getModelFamily('DeepSeek-V2')).toBe('deepseek');
  });

  it('detects Cohere models', () => {
    expect(getModelFamily('cohere-command-r')).toBe('cohere');
    expect(getModelFamily('command-r-plus')).toBe('cohere');
  });

  it('detects Perplexity models', () => {
    expect(getModelFamily('perplexity-online')).toBe('perplexity');
    expect(getModelFamily('pplx-7b-chat')).toBe('perplexity');
  });

  it('returns "other" for unrecognized models', () => {
    expect(getModelFamily('some-custom-model')).toBe('other');
    expect(getModelFamily('my-fine-tuned-model')).toBe('other');
  });

  it('is case insensitive', () => {
    expect(getModelFamily('CLAUDE-3')).toBe('claude');
    expect(getModelFamily('GPT-4')).toBe('gpt');
    expect(getModelFamily('GEMINI-PRO')).toBe('gemini');
  });
});

describe('computeModelDiversityIndex', () => {
  it('returns 0 for empty array', () => {
    expect(computeModelDiversityIndex([])).toBe(0);
  });

  it('returns 0 for single family (all same model)', () => {
    expect(computeModelDiversityIndex(['claude', 'claude', 'claude'])).toBe(0);
  });

  it('returns 0.5 for two equally split families', () => {
    // HHI = 0.5^2 + 0.5^2 = 0.5, MDI = 1 - 0.5 = 0.5
    expect(computeModelDiversityIndex(['claude', 'gpt'])).toBe(0.5);
  });

  it('returns higher index for more diverse groups', () => {
    const twoway = computeModelDiversityIndex(['claude', 'gpt']);
    const threeway = computeModelDiversityIndex(['claude', 'gpt', 'gemini']);
    const fourway = computeModelDiversityIndex(['claude', 'gpt', 'gemini', 'llama']);

    expect(threeway).toBeGreaterThan(twoway);
    expect(fourway).toBeGreaterThan(threeway);
  });

  it('computes correct MDI for balanced 3-family split', () => {
    // HHI = 3 * (1/3)^2 = 3/9 = 0.333..., MDI = 1 - 0.333... = 0.667
    const mdi = computeModelDiversityIndex(['claude', 'gpt', 'gemini']);
    expect(mdi).toBeCloseTo(0.67, 1);
  });

  it('computes correct MDI for balanced 4-family split', () => {
    // HHI = 4 * (1/4)^2 = 4/16 = 0.25, MDI = 0.75
    const mdi = computeModelDiversityIndex(['claude', 'gpt', 'gemini', 'llama']);
    expect(mdi).toBe(0.75);
  });

  it('accounts for imbalanced distributions', () => {
    // 3 claude, 1 gpt: HHI = (3/4)^2 + (1/4)^2 = 9/16 + 1/16 = 10/16 = 0.625
    // MDI = 1 - 0.625 = 0.375
    const mdi = computeModelDiversityIndex(['claude', 'claude', 'claude', 'gpt']);
    expect(mdi).toBeCloseTo(0.38, 1);
  });

  it('returns value rounded to 2 decimal places', () => {
    const mdi = computeModelDiversityIndex(['claude', 'gpt', 'gemini']);
    const decimalPlaces = mdi.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it('handles single participant', () => {
    // HHI = 1^2 = 1, MDI = 1 - 1 = 0
    expect(computeModelDiversityIndex(['claude'])).toBe(0);
  });

  it('handles large groups with good diversity', () => {
    const families = [
      'claude',
      'claude',
      'gpt',
      'gpt',
      'gemini',
      'gemini',
      'llama',
      'llama',
      'mistral',
      'mistral',
    ];
    // 5 families, each with 2: HHI = 5 * (2/10)^2 = 5 * 0.04 = 0.2
    // MDI = 0.8
    const mdi = computeModelDiversityIndex(families);
    expect(mdi).toBe(0.8);
  });
});

describe('computeCrossModelConsensus', () => {
  it('returns 0 for empty votes', () => {
    expect(computeCrossModelConsensus([])).toBe(0);
  });

  it('returns 1.0 when all families support', () => {
    const votes = [
      { model_family: 'claude', vote: 'support' },
      { model_family: 'gpt', vote: 'support' },
      { model_family: 'gemini', vote: 'support' },
    ];
    expect(computeCrossModelConsensus(votes)).toBe(1);
  });

  it('returns 0 when no families support', () => {
    const votes = [
      { model_family: 'claude', vote: 'oppose' },
      { model_family: 'gpt', vote: 'oppose' },
    ];
    expect(computeCrossModelConsensus(votes)).toBe(0);
  });

  it('returns correct ratio for mixed votes', () => {
    // 2 out of 3 families support
    const votes = [
      { model_family: 'claude', vote: 'support' },
      { model_family: 'gpt', vote: 'support' },
      { model_family: 'gemini', vote: 'oppose' },
    ];
    expect(computeCrossModelConsensus(votes)).toBeCloseTo(0.67, 1);
  });

  it('counts families not individual votes', () => {
    // Multiple agents from same family: claude supports (2 agents), gpt opposes (1 agent)
    const votes = [
      { model_family: 'claude', vote: 'support' },
      { model_family: 'claude', vote: 'support' },
      { model_family: 'gpt', vote: 'oppose' },
    ];
    // 1 supporting family (claude) / 2 total families = 0.5
    expect(computeCrossModelConsensus(votes)).toBe(0.5);
  });

  it('handles abstain votes (counted in family total but not support)', () => {
    const votes = [
      { model_family: 'claude', vote: 'support' },
      { model_family: 'gpt', vote: 'abstain' },
      { model_family: 'gemini', vote: 'oppose' },
    ];
    // 1 supporting family / 3 total families = 0.33
    expect(computeCrossModelConsensus(votes)).toBeCloseTo(0.33, 1);
  });

  it('a family that has both support and oppose still counts as supporting', () => {
    // If any agent in a family supports, that family is in the supporting set
    const votes = [
      { model_family: 'claude', vote: 'support' },
      { model_family: 'claude', vote: 'oppose' },
      { model_family: 'gpt', vote: 'oppose' },
    ];
    // claude family supports (has at least one support), gpt opposes: 1/2 = 0.5
    expect(computeCrossModelConsensus(votes)).toBe(0.5);
  });

  it('returns value rounded to 2 decimal places', () => {
    const votes = [
      { model_family: 'claude', vote: 'support' },
      { model_family: 'gpt', vote: 'oppose' },
      { model_family: 'gemini', vote: 'support' },
    ];
    const consensus = computeCrossModelConsensus(votes);
    const decimalPlaces = consensus.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it('handles single family voting', () => {
    const votes = [{ model_family: 'claude', vote: 'support' }];
    expect(computeCrossModelConsensus(votes)).toBe(1);
  });

  it('handles single family opposing', () => {
    const votes = [{ model_family: 'claude', vote: 'oppose' }];
    expect(computeCrossModelConsensus(votes)).toBe(0);
  });
});
