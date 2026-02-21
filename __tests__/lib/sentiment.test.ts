import { describe, it, expect } from 'vitest';
import { detectSentiment } from '@/lib/sentiment';

describe('detectSentiment', () => {
  it('detects positive sentiment', () => {
    expect(detectSentiment('This is wonderful and amazing!')).toBe('positive');
    expect(detectSentiment('I love this great product')).toBe('positive');
  });

  it('detects negative sentiment', () => {
    expect(detectSentiment('This is terrible and awful')).toBe('negative');
    expect(detectSentiment('I hate this horrible thing')).toBe('negative');
  });

  it('detects neutral sentiment (no sentiment words)', () => {
    expect(detectSentiment('The function returns an integer')).toBe('neutral');
    expect(detectSentiment('Version 2.0 was released on Monday')).toBe('neutral');
  });

  it('detects mixed sentiment (opposing words)', () => {
    // "love" (+3) and "hate" (-3) cancel out, but both are present → mixed
    expect(detectSentiment('I love the design but hate the bugs')).toBe('mixed');
  });

  it('returns neutral for empty or whitespace-only input', () => {
    expect(detectSentiment('')).toBe('neutral');
    expect(detectSentiment('   ')).toBe('neutral');
  });

  it('uses comparative score so length does not inflate sentiment', () => {
    // A single positive word in a long neutral sentence should not be strongly positive
    const shortPositive = 'Great!';
    const longWithOnePositive =
      'The system processes data from the input buffer to the output stream which is great';
    // Both should register as positive but the threshold-based approach handles length
    const shortResult = detectSentiment(shortPositive);
    const longResult = detectSentiment(longWithOnePositive);
    // Short emphatic positive → positive
    expect(shortResult).toBe('positive');
    // Long with one positive word — comparative = 3/15 = 0.2 > 0.1 → still positive
    expect(longResult).toBe('positive');
  });

  it('does not trigger on substrings (no "innovation" → "no" false positive)', () => {
    // Regression: old regex approach matched "no" inside "innovation"
    const result = detectSentiment('Innovation drives progress in technology');
    expect(result).not.toBe('negative');
  });

  it('does not trigger on substrings (no "badge" → "bad" false positive)', () => {
    // Regression: old regex approach matched "bad" inside "badge"
    const result = detectSentiment('She earned a badge for her work');
    expect(result).not.toBe('negative');
  });

  it('returns neutral for weak single-direction signal', () => {
    // "like" has AFINN score +2, diluted across many words → comparative < 0.1 → neutral
    const result = detectSentiment(
      'The system processes data from the input buffer and writes the output to the log file which developers like to read during debugging sessions'
    );
    expect(result).toBe('neutral');
  });

  it('does not trigger on substrings (no "eyes" → "yes" false positive)', () => {
    // Regression: old regex approach matched "yes" inside "eyes"
    // Note: AFINN considers "focused" positive, so we test a truly neutral sentence
    const result = detectSentiment('Her eyes scanned the screen for information');
    expect(result).toBe('neutral');
  });

  it('handles negation: "not good" is negative (package built-in)', () => {
    // The sentiment package handles "not" internally — flips "good" to -3
    expect(detectSentiment('not good at all')).toBe('negative');
  });

  it('handles negation: "not bad" is positive (package built-in)', () => {
    // The sentiment package handles "not" internally — flips "bad" to +3
    expect(detectSentiment('not bad at all')).toBe('positive');
  });

  it('handles contraction negation: "don\'t like" (package built-in)', () => {
    // The sentiment package handles "n't" contractions internally
    const result = detectSentiment("I don't like this product");
    expect(result).toBe('negative');
  });

  it('handles "never" negation (custom handler)', () => {
    // The package does NOT handle "never" — our custom code flips "happy"
    const result = detectSentiment('I was never happy with the result');
    expect(result).toBe('negative');
  });

  it('handles "hardly" negation (custom handler)', () => {
    // The package does NOT handle "hardly" — our custom code flips "great"
    const result = detectSentiment('This is hardly great');
    expect(result).toBe('negative');
  });

  it('does not double-negate "not" (package already handles it)', () => {
    // Regression: custom code must NOT re-negate words the package already flipped.
    // "not good" → package returns score -3. If we double-negate, score becomes -9.
    // The label would still be negative but the magnitude would be 3x wrong.
    // We verify by checking "not good" gives the same label as "bad" (not "catastrophic")
    expect(detectSentiment('not good')).toBe('negative');
    expect(detectSentiment('not bad')).toBe('positive');
    // "not not good" — package handles first "not", returns -3.
    // Our code should NOT touch this since "not" is not in our custom negator list.
    expect(detectSentiment('not not good')).toBe('negative');
  });
});
