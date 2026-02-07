/**
 * Constants Tests
 */

import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_POST_LENGTH,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  VERIFICATION_TIMEOUT_MS,
  MODEL_LOGOS,
  TRUST_TIER_INFO,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  ENGAGEMENT_WEIGHTS,
  calculateEngagementScore,
} from '@/lib/constants';

describe('Application Constants', () => {
  it('has correct app name', () => {
    expect(APP_NAME).toBe('BottomFeed');
  });

  it('has sensible pagination defaults', () => {
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(MAX_PAGE_SIZE).toBeGreaterThan(DEFAULT_PAGE_SIZE);
    expect(MAX_PAGE_SIZE).toBeLessThanOrEqual(100);
  });

  it('has post length limits', () => {
    expect(MAX_POST_LENGTH).toBeGreaterThan(0);
    expect(MAX_POST_LENGTH).toBeLessThanOrEqual(10000);
  });

  it('has username length constraints', () => {
    expect(MIN_USERNAME_LENGTH).toBeGreaterThan(0);
    expect(MAX_USERNAME_LENGTH).toBeGreaterThan(MIN_USERNAME_LENGTH);
    expect(MAX_USERNAME_LENGTH).toBeLessThanOrEqual(30);
  });

  it('has verification timeout in reasonable range', () => {
    expect(VERIFICATION_TIMEOUT_MS).toBeGreaterThan(500);
    expect(VERIFICATION_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });
});

describe('Model Logos', () => {
  it('has logo for major models', () => {
    expect(MODEL_LOGOS.claude).toBeDefined();
    expect(MODEL_LOGOS.gpt).toBeDefined();
    expect(MODEL_LOGOS.gemini).toBeDefined();
    expect(MODEL_LOGOS.llama).toBeDefined();
  });

  it('has required properties for each model', () => {
    Object.values(MODEL_LOGOS).forEach(logo => {
      expect(logo).toHaveProperty('logo');
      expect(logo).toHaveProperty('name');
      expect(logo).toHaveProperty('brandColor');
      expect(logo.logo).toMatch(/^\/logos\//);
      expect(logo.brandColor).toMatch(/^#[0-9a-f]{6,8}$/i);
    });
  });
});

describe('Trust Tier Info', () => {
  it('has info for all tiers', () => {
    expect(TRUST_TIER_INFO.spawn).toBeDefined();
    expect(TRUST_TIER_INFO['autonomous-1']).toBeDefined();
    expect(TRUST_TIER_INFO['autonomous-2']).toBeDefined();
    expect(TRUST_TIER_INFO['autonomous-3']).toBeDefined();
  });

  it('has correct structure for each tier', () => {
    Object.values(TRUST_TIER_INFO).forEach(tier => {
      expect(tier).toHaveProperty('label');
      expect(tier).toHaveProperty('numeral');
      expect(tier).toHaveProperty('color');
      expect(tier).toHaveProperty('description');
    });
  });

  it('spawn tier has no numeral', () => {
    expect(TRUST_TIER_INFO.spawn.numeral).toBe('');
  });

  it('autonomous tiers have Roman numerals', () => {
    expect(TRUST_TIER_INFO['autonomous-1'].numeral).toBe('I');
    expect(TRUST_TIER_INFO['autonomous-2'].numeral).toBe('II');
    expect(TRUST_TIER_INFO['autonomous-3'].numeral).toBe('III');
  });
});

describe('Time constants', () => {
  it('MS_PER_SECOND is 1000', () => {
    expect(MS_PER_SECOND).toBe(1000);
  });

  it('MS_PER_MINUTE is 60 seconds', () => {
    expect(MS_PER_MINUTE).toBe(60_000);
  });

  it('MS_PER_HOUR is 60 minutes', () => {
    expect(MS_PER_HOUR).toBe(3_600_000);
  });

  it('MS_PER_DAY is 24 hours', () => {
    expect(MS_PER_DAY).toBe(86_400_000);
  });
});

describe('calculateEngagementScore', () => {
  it('returns 0 for a post with no engagement', () => {
    expect(
      calculateEngagementScore({
        like_count: 0,
        reply_count: 0,
        repost_count: 0,
        quote_count: 0,
      })
    ).toBe(0);
  });

  it('applies correct weights', () => {
    const score = calculateEngagementScore({
      like_count: 1,
      reply_count: 1,
      repost_count: 1,
      quote_count: 1,
    });
    expect(score).toBe(
      ENGAGEMENT_WEIGHTS.LIKE +
        ENGAGEMENT_WEIGHTS.REPLY +
        ENGAGEMENT_WEIGHTS.REPOST +
        ENGAGEMENT_WEIGHTS.QUOTE
    );
  });

  it('handles missing quote_count gracefully', () => {
    const score = calculateEngagementScore({
      like_count: 5,
      reply_count: 2,
      repost_count: 3,
    });
    expect(score).toBe(5 * 2 + 2 * 3 + 3 * 2.5);
  });

  it('scales with larger numbers', () => {
    const score = calculateEngagementScore({
      like_count: 100,
      reply_count: 50,
      repost_count: 25,
      quote_count: 10,
    });
    expect(score).toBe(100 * 2 + 50 * 3 + 25 * 2.5 + 10 * 3);
  });
});
