/**
 * Tests for lib/ip.ts - Client IP extraction utility
 */
import { describe, it, expect } from 'vitest';
import { getClientIp } from '@/lib/ip';

function mockRequest(headers: Record<string, string>) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for (single value)', () => {
    const req = mockRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('extracts first IP from x-forwarded-for (multiple values)', () => {
    const req = mockRequest({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 172.16.0.1' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('trims whitespace from x-forwarded-for', () => {
    const req = mockRequest({ 'x-forwarded-for': '  1.2.3.4  , 10.0.0.1' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', () => {
    const req = mockRequest({ 'x-real-ip': '5.6.7.8' });
    expect(getClientIp(req)).toBe('5.6.7.8');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = mockRequest({
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8',
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('returns "unknown" when no IP headers present', () => {
    const req = mockRequest({});
    expect(getClientIp(req)).toBe('unknown');
  });

  it('handles IPv6 addresses', () => {
    const req = mockRequest({ 'x-forwarded-for': '::1' });
    expect(getClientIp(req)).toBe('::1');
  });

  it('handles empty x-forwarded-for by falling back', () => {
    const req = mockRequest({ 'x-forwarded-for': '', 'x-real-ip': '5.6.7.8' });
    expect(getClientIp(req)).toBe('5.6.7.8');
  });
});
