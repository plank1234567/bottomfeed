/**
 * Property-Based Tests using fast-check
 * Validates invariants that must hold for ALL inputs, not just hand-picked examples.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseLimit, encodeCursor, decodeCursor, validateUUID } from '@/lib/api-utils';
import { sanitizePostContent, sanitizeUrl } from '@/lib/sanitize';
import { hashApiKey } from '@/lib/db-supabase/client';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants';

describe('property-based tests', () => {
  describe('parseLimit', () => {
    it('output is always in [1, MAX_PAGE_SIZE] for any input', () => {
      fc.assert(
        fc.property(fc.string(), raw => {
          const params = new URLSearchParams();
          params.set('limit', raw);
          const result = parseLimit(params);
          expect(result).toBeGreaterThanOrEqual(1);
          expect(result).toBeLessThanOrEqual(MAX_PAGE_SIZE);
        }),
        { numRuns: 500 }
      );
    });

    it('output is always in [1, maxLimit] for any numeric input', () => {
      fc.assert(
        fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), n => {
          const params = new URLSearchParams();
          params.set('limit', String(n));
          const result = parseLimit(params);
          expect(result).toBeGreaterThanOrEqual(1);
          expect(result).toBeLessThanOrEqual(MAX_PAGE_SIZE);
        }),
        { numRuns: 500 }
      );
    });

    it('returns defaultLimit when limit param is missing', () => {
      fc.assert(
        fc.property(fc.constant(undefined), () => {
          const params = new URLSearchParams();
          const result = parseLimit(params);
          expect(result).toBe(DEFAULT_PAGE_SIZE);
        }),
        { numRuns: 1 }
      );
    });
  });

  describe('sanitizePostContent', () => {
    it('output never contains <script, javascript:, or onerror=', () => {
      fc.assert(
        fc.property(fc.string(), input => {
          const result = sanitizePostContent(input);
          const lower = result.toLowerCase();
          expect(lower).not.toContain('<script');
          expect(lower).not.toContain('javascript:');
          expect(lower).not.toContain('onerror=');
        }),
        { numRuns: 500 }
      );
    });

    it('output never contains event handler attributes', () => {
      // Test with strings that include XSS attempts
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.constant('<img src=x onerror=alert(1)>'),
            fc.constant('<script>alert(1)</script>'),
            fc.constant('<a href="javascript:alert(1)">click</a>'),
            fc.constant('<svg onload=alert(1)>'),
            fc.constant('<div onmouseover="alert(1)">hover</div>')
          ),
          input => {
            const result = sanitizePostContent(input);
            const lower = result.toLowerCase();
            expect(lower).not.toContain('onerror=');
            expect(lower).not.toContain('onload=');
            expect(lower).not.toContain('onmouseover=');
            expect(lower).not.toContain('<script');
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('sanitizeUrl', () => {
    it('output is always empty string or starts with http:// or https://', () => {
      fc.assert(
        fc.property(fc.string(), input => {
          const result = sanitizeUrl(input);
          if (result !== '') {
            expect(result.startsWith('http://') || result.startsWith('https://')).toBe(true);
          }
        }),
        { numRuns: 500 }
      );
    });

    it('never returns javascript: URLs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.constant('javascript:alert(1)'),
            fc.constant('JAVASCRIPT:alert(1)'),
            fc.constant('  javascript:alert(1)  '),
            fc.constant('data:text/html,<script>alert(1)</script>'),
            fc.constant('vbscript:MsgBox("xss")')
          ),
          input => {
            const result = sanitizeUrl(input);
            if (result !== '') {
              const lower = result.toLowerCase();
              expect(lower.startsWith('javascript:')).toBe(false);
              expect(lower.startsWith('data:')).toBe(false);
              expect(lower.startsWith('vbscript:')).toBe(false);
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('encodeCursor / decodeCursor roundtrip', () => {
    it('roundtrips for any timestamp and UUID', () => {
      const uuidArb = fc.uuid();
      const timestampArb = fc
        .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
        .map(d => d.toISOString());

      fc.assert(
        fc.property(timestampArb, uuidArb, (createdAt, id) => {
          const encoded = encodeCursor(createdAt, id);
          const decoded = decodeCursor(encoded);
          expect(decoded.createdAt).toBe(createdAt);
          expect(decoded.id).toBe(id);
        }),
        { numRuns: 500 }
      );
    });

    it('decodeCursor handles legacy plain-timestamp format', () => {
      const timestampArb = fc
        .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
        .map(d => d.toISOString());

      fc.assert(
        fc.property(timestampArb, ts => {
          // Legacy cursors are just timestamps (no pipe separator)
          const decoded = decodeCursor(ts);
          expect(decoded.createdAt).toBe(ts);
          expect(decoded.id).toBeNull();
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('validateUUID', () => {
    it('valid UUIDs never throw', () => {
      fc.assert(
        fc.property(fc.uuid(), uuid => {
          expect(() => validateUUID(uuid)).not.toThrow();
        }),
        { numRuns: 500 }
      );
    });

    it('random non-UUID strings always throw', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              s => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
            ),
          nonUuid => {
            expect(() => validateUUID(nonUuid)).toThrow();
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('hashApiKey', () => {
    it('always returns a 64-character hex string', () => {
      fc.assert(
        fc.property(fc.string(), input => {
          const hash = hashApiKey(input);
          expect(hash).toHaveLength(64);
          expect(hash).toMatch(/^[a-f0-9]{64}$/);
        }),
        { numRuns: 500 }
      );
    });

    it('is deterministic — same input always produces same output', () => {
      fc.assert(
        fc.property(fc.string(), input => {
          const hash1 = hashApiKey(input);
          const hash2 = hashApiKey(input);
          expect(hash1).toBe(hash2);
        }),
        { numRuns: 200 }
      );
    });

    it('different inputs produce different hashes (collision resistance)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (a, b) => {
          fc.pre(a !== b); // Skip when inputs are equal
          const hashA = hashApiKey(a);
          const hashB = hashApiKey(b);
          expect(hashA).not.toBe(hashB);
        }),
        { numRuns: 200 }
      );
    });
  });
});
