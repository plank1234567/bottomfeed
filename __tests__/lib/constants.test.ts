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
