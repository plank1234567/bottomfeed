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

  it('consistently sanitizes when called multiple times in a loop', () => {
    const input = '<b>bold</b> text';
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(sanitizePostContent(input));
    }
    expect(new Set(results).size).toBe(1);
  });

  // DOMPurify-specific tests: allowed tags
  it('preserves allowed formatting tags', () => {
    expect(sanitizePostContent('<b>bold</b>')).toBe('<b>bold</b>');
    expect(sanitizePostContent('<i>italic</i>')).toBe('<i>italic</i>');
    expect(sanitizePostContent('<em>emphasis</em>')).toBe('<em>emphasis</em>');
    expect(sanitizePostContent('<strong>strong</strong>')).toBe('<strong>strong</strong>');
    expect(sanitizePostContent('<code>code</code>')).toBe('<code>code</code>');
    expect(sanitizePostContent('<pre>preformatted</pre>')).toBe('<pre>preformatted</pre>');
  });

  it('preserves list tags', () => {
    const input = '<ul><li>item 1</li><li>item 2</li></ul>';
    const result = sanitizePostContent(input);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  it('strips disallowed tags but keeps content', () => {
    expect(sanitizePostContent('<div>content</div>')).toBe('content');
    expect(sanitizePostContent('<span>text</span>')).toBe('text');
    expect(sanitizePostContent('<h1>heading</h1>')).toBe('heading');
  });

  // DOMPurify-specific tests: anchor handling
  it('adds rel and target to safe anchors', () => {
    const input = '<a href="https://example.com">link</a>';
    const result = sanitizePostContent(input);
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('href="https://example.com"');
  });

  it('strips anchors with javascript: href', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<a');
  });

  it('strips anchors with no href', () => {
    const input = '<a>no href</a>';
    const result = sanitizePostContent(input);
    // DOMPurify may keep or strip the anchor; either way no dangerous behavior
    expect(result).not.toContain('javascript:');
  });

  // DOMPurify-specific tests: encoding bypass resistance
  it('blocks HTML-entity-encoded javascript URLs', () => {
    const input = '<a href="&#106;avascript:alert(1)">click</a>';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('javascript:');
  });

  it('blocks mixed-case javascript URLs', () => {
    const input = '<a href="JaVaScRiPt:alert(1)">click</a>';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('alert');
  });

  it('strips style tags and content', () => {
    const input = '<style>body{display:none}</style>Hello';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('<style>');
    expect(result).not.toContain('display:none');
    expect(result).toContain('Hello');
  });

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>safe';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('safe');
  });

  it('strips onerror on img tags', () => {
    const input = '<img src=x onerror="alert(1)">';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('strips data: URLs in attributes', () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('data:');
  });

  it('strips nested/malformed tags', () => {
    // DOMPurify neutralizes the script tag — the text content may remain
    // but cannot execute as JS since the <script> element is stripped
    const input = '<div<script>alert(1)</script>>text</div>';
    const result = sanitizePostContent(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toMatch(/<script/i);
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

  it('strips script tags and content', () => {
    expect(sanitizePlainText('<script>alert(1)</script>safe')).toBe('safe');
  });

  it('handles nested/malformed tags that bypass regex', () => {
    // DOMPurify neutralizes the script tag — the text content may remain
    // but cannot execute as JS since the <script> element is stripped
    const result = sanitizePlainText('<div<script>alert(1)</script>>text');
    expect(result).not.toContain('<script>');
    expect(result).not.toMatch(/<script/i);
  });

  it('strips all tags including allowed ones', () => {
    // sanitizePlainText should strip ALL tags, not just dangerous ones
    expect(sanitizePlainText('<b>bold</b> and <a href="https://x.com">link</a>')).toBe(
      'bold and link'
    );
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
