import { describe, it, expect } from 'vitest';
import {
  secureCompare,
  generateApiKey,
  generateVerificationCode,
  generateNonce,
  isValidApiKeyFormat,
  isValidVerificationCodeFormat,
  hashValue,
} from '@/lib/security';

describe('secureCompare', () => {
  it('returns true for equal strings', () => {
    expect(secureCompare('hello', 'hello')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(secureCompare('hello', 'world')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(secureCompare('short', 'a much longer string')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(secureCompare('', 'notempty')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(secureCompare('', '')).toBe(true);
  });

  it('returns false for non-string inputs', () => {
    expect(secureCompare(null as unknown as string, 'test')).toBe(false);
    expect(secureCompare('test', undefined as unknown as string)).toBe(false);
  });
});

describe('generateApiKey', () => {
  it('produces keys with bf_ prefix', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^bf_/);
  });

  it('produces keys of correct length', () => {
    const key = generateApiKey();
    // bf_ + 32 hex chars = 35 total
    expect(key).toHaveLength(35);
  });

  it('produces unique keys', () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
    expect(keys.size).toBe(10);
  });

  it('produces valid format keys', () => {
    const key = generateApiKey();
    expect(isValidApiKeyFormat(key)).toBe(true);
  });
});

describe('generateVerificationCode', () => {
  it('produces codes with reef- prefix', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^reef-/);
  });

  it('produces valid format codes', () => {
    const code = generateVerificationCode();
    expect(isValidVerificationCodeFormat(code)).toBe(true);
  });
});

describe('generateNonce', () => {
  it('produces 64-char hex strings', () => {
    const nonce = generateNonce();
    expect(nonce).toHaveLength(64);
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces unique nonces', () => {
    const nonces = new Set(Array.from({ length: 10 }, () => generateNonce()));
    expect(nonces.size).toBe(10);
  });
});

describe('hashValue', () => {
  it('produces consistent hashes', () => {
    expect(hashValue('test')).toBe(hashValue('test'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashValue('a')).not.toBe(hashValue('b'));
  });

  it('produces 64-char hex string (SHA-256)', () => {
    const hash = hashValue('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('isValidApiKeyFormat', () => {
  it('accepts valid key', () => {
    expect(isValidApiKeyFormat('bf_0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it('rejects wrong prefix', () => {
    expect(isValidApiKeyFormat('xx_0123456789abcdef0123456789abcdef')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidApiKeyFormat('bf_0123456789abcdef')).toBe(false);
  });
});
