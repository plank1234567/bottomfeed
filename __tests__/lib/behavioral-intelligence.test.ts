import { describe, it, expect } from 'vitest';
import { analyzePersonalityText } from '@/lib/behavioral-intelligence';

describe('analyzePersonalityText', () => {
  it('returns 8 dimensions for any input', () => {
    const result = analyzePersonalityText('A simple personality');
    expect(result).toHaveLength(8);
    expect(result.map(d => d.key)).toEqual([
      'intellectual_hunger',
      'social_assertiveness',
      'empathic_resonance',
      'contrarian_spirit',
      'creative_expression',
      'tribal_loyalty',
      'strategic_thinking',
      'emotional_intensity',
    ]);
  });

  it('scores are in 0-100 range', () => {
    const result = analyzePersonalityText('An analytical creative empathetic bold visionary');
    for (const dim of result) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });

  it('confidence is fixed at 0.5 for text-derived profiles', () => {
    const result = analyzePersonalityText('Any text');
    for (const dim of result) {
      expect(dim.confidence).toBe(0.5);
    }
  });

  it('trend is always stable for text-derived profiles', () => {
    const result = analyzePersonalityText('Any text');
    for (const dim of result) {
      expect(dim.trend).toBe('stable');
    }
  });

  it('boosts intellectual_hunger for research-related keywords', () => {
    const result = analyzePersonalityText(
      'analytical research-driven curious scholar who loves data and evidence-based logic'
    );
    const ih = result.find(d => d.key === 'intellectual_hunger')!;
    expect(ih.score).toBeGreaterThan(50);
  });

  it('boosts social_assertiveness for leadership keywords', () => {
    const result = analyzePersonalityText(
      'bold confident leader who takes initiative and is very proactive'
    );
    const sa = result.find(d => d.key === 'social_assertiveness')!;
    expect(sa.score).toBeGreaterThan(50);
  });

  it('boosts empathic_resonance for caring keywords', () => {
    const result = analyzePersonalityText(
      'caring empathetic supportive gentle nurturing patient listener'
    );
    const er = result.find(d => d.key === 'empathic_resonance')!;
    expect(er.score).toBeGreaterThan(50);
  });

  it('boosts contrarian_spirit for skeptic keywords', () => {
    const result = analyzePersonalityText(
      'contrarian skeptic who questions everything and plays devil advocate'
    );
    const cs = result.find(d => d.key === 'contrarian_spirit')!;
    expect(cs.score).toBeGreaterThan(50);
  });

  it('boosts creative_expression for creative keywords', () => {
    const result = analyzePersonalityText(
      'creative imaginative artistic innovative original visionary'
    );
    const ce = result.find(d => d.key === 'creative_expression')!;
    expect(ce.score).toBeGreaterThan(50);
  });

  it('boosts tribal_loyalty for community keywords', () => {
    const result = analyzePersonalityText(
      'loyal community-oriented team player who values belonging and collective goals'
    );
    const tl = result.find(d => d.key === 'tribal_loyalty')!;
    expect(tl.score).toBeGreaterThan(50);
  });

  it('boosts strategic_thinking for methodical keywords', () => {
    const result = analyzePersonalityText(
      'strategic methodical systematic deliberate calculated planned precise'
    );
    const st = result.find(d => d.key === 'strategic_thinking')!;
    expect(st.score).toBeGreaterThan(50);
  });

  it('boosts emotional_intensity for passionate keywords', () => {
    const result = analyzePersonalityText(
      'passionate intense emotional enthusiastic dramatic fiery spirited'
    );
    const ei = result.find(d => d.key === 'emotional_intensity')!;
    expect(ei.score).toBeGreaterThan(50);
  });

  it('reduces scores with negative keywords', () => {
    const shy = analyzePersonalityText('quiet shy reserved passive withdrawn introvert');
    const sa = shy.find(d => d.key === 'social_assertiveness')!;
    expect(sa.score).toBeLessThan(50);
  });

  it('handles empty string without error', () => {
    const result = analyzePersonalityText('');
    expect(result).toHaveLength(8);
    for (const dim of result) {
      expect(dim.score).toBe(50); // neutral default
    }
  });

  it('is case-insensitive', () => {
    const lower = analyzePersonalityText('analytical research');
    const upper = analyzePersonalityText('ANALYTICAL RESEARCH');
    expect(lower[0]!.score).toBe(upper[0]!.score);
  });

  it('differentiated profile: scholar vs rebel', () => {
    const scholar = analyzePersonalityText(
      'scholarly analytical rigorous evidence-based researcher'
    );
    const rebel = analyzePersonalityText(
      'rebellious contrarian who disagrees with conventional wisdom'
    );
    const scholarIH = scholar.find(d => d.key === 'intellectual_hunger')!;
    const rebelCS = rebel.find(d => d.key === 'contrarian_spirit')!;
    // Scholar should be high on IH, rebel should be high on CS
    expect(scholarIH.score).toBeGreaterThan(50);
    expect(rebelCS.score).toBeGreaterThan(50);
  });
});
