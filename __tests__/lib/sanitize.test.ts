import { describe, it, expect } from 'vitest';
import {
  sanitizePostContent,
  sanitizeUrl,
  sanitizePlainText,
  sanitizeMediaUrls,
} from '@/lib/sanitize';

describe('sanitizePostContent', () => {
  it('preserves plain text', () => {
    expect(sanitizePostContent('Hello world')).toBe('Hello world');
  });

  it('strips dangerous HTML tags', () => {
    const input = '<script>alert("xss")</script>Hello';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  it('strips event handler attributes', () => {
    const input = '<div onclick="alert(1)">Click me</div>';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('onclick');
  });

  it('preserves mentions and hashtags', () => {
    const input = '@agent_bot check out #trending';
    expect(sanitizePostContent(input)).toContain('@agent_bot');
    expect(sanitizePostContent(input)).toContain('#trending');
  });

  it('handles empty content', () => {
    expect(sanitizePostContent('')).toBe('');
  });

  it('handles content with only whitespace', () => {
    const result = sanitizePostContent('   ');
    expect(result.trim()).toBe('');
  });

  // Regression test for the g flag bug (Fix 8)
  it('consistently sanitizes when called multiple times in a loop', () => {
    const input = '<b>bold</b> text';
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(sanitizePostContent(input));
    }
    // All results should be identical (no alternating behavior from g flag)
    expect(new Set(results).size).toBe(1);
  });
});

describe('sanitizeUrl', () => {
  it('allows http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('allows https URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('rejects javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeUrl('')).toBe('');
  });

  it('handles invalid URLs', () => {
    expect(sanitizeUrl('not a url')).toBe('');
  });

  it('rejects vbscript: URLs', () => {
    expect(sanitizeUrl('vbscript:msgbox("xss")')).toBe('');
  });
});

describe('sanitizePlainText', () => {
  it('removes HTML tags', () => {
    expect(sanitizePlainText('<b>bold</b>')).toBe('bold');
  });

  it('preserves plain text', () => {
    expect(sanitizePlainText('Hello world')).toBe('Hello world');
  });
});

describe('sanitizeMediaUrls', () => {
  it('filters out invalid URLs', () => {
    const urls = [
      'https://example.com/img.png',
      'javascript:alert(1)',
      'https://valid.com/pic.jpg',
    ];
    const result = sanitizeMediaUrls(urls);
    expect(result).toHaveLength(2);
    expect(result).toContain('https://example.com/img.png');
    expect(result).toContain('https://valid.com/pic.jpg');
  });

  it('handles empty array', () => {
    expect(sanitizeMediaUrls([])).toHaveLength(0);
  });
});
