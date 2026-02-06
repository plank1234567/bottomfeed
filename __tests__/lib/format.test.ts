/**
 * Tests for format utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  formatFullDate,
  formatCount,
  getInitials,
  truncateText,
} from '@/lib/utils/format';

describe('formatCount', () => {
  it('returns "0" for zero', () => {
    expect(formatCount(0)).toBe('0');
  });

  it('returns plain number for small counts', () => {
    expect(formatCount(1)).toBe('1');
    expect(formatCount(42)).toBe('42');
    expect(formatCount(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatCount(1000)).toBe('1.0K');
    expect(formatCount(1500)).toBe('1.5K');
    expect(formatCount(15000)).toBe('15.0K');
    expect(formatCount(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatCount(1000000)).toBe('1.0M');
    expect(formatCount(2500000)).toBe('2.5M');
    expect(formatCount(10000000)).toBe('10.0M');
  });
});

describe('formatRelativeTime', () => {
  it('returns "now" for very recent dates', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('now');
  });

  it('returns minutes for recent dates', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m');
  });

  it('returns hours for dates within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h');
  });

  it('returns days for older dates', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d');
  });

  it('handles future dates (returns "now" since diff is negative)', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    // Negative diff means mins < 1, so returns 'now'
    expect(formatRelativeTime(future)).toBe('now');
  });
});

describe('formatFullDate', () => {
  it('formats a date string to localized full date', () => {
    const result = formatFullDate('2025-06-15T14:30:00Z');
    // Check it contains expected parts (locale-dependent)
    expect(result).toContain('2025');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
  });
});

describe('getInitials', () => {
  it('returns two-letter initials from a full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns single-letter initial from a single word', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('returns "AI" for empty string', () => {
    expect(getInitials('')).toBe('AI');
  });

  it('truncates to 2 characters for names with many words', () => {
    expect(getInitials('The Amazing Spider Man')).toBe('TA');
  });

  it('handles undefined/null gracefully (returns "AI")', () => {
    // The function uses optional chaining: name?.split(...)
    expect(getInitials(undefined as unknown as string)).toBe('AI');
    expect(getInitials(null as unknown as string)).toBe('AI');
  });
});

describe('truncateText', () => {
  it('does not truncate short text', () => {
    const result = truncateText('Hello', 100);
    expect(result.text).toBe('Hello');
    expect(result.truncated).toBe(false);
  });

  it('truncates long text at word boundary with ellipsis', () => {
    const result = truncateText('The quick brown fox jumps over the lazy dog', 20);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith('...')).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(23); // 20 + "..."
  });

  it('returns empty string with truncated=false for empty input', () => {
    const result = truncateText('', 10);
    expect(result.text).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('handles text exactly at maxLength', () => {
    const result = truncateText('Hello', 5);
    expect(result.text).toBe('Hello');
    expect(result.truncated).toBe(false);
  });

  it('handles single long word', () => {
    const result = truncateText('superlongwordwithoutspaces', 10);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith('...')).toBe(true);
  });
});
