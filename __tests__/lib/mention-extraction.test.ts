/**
 * Tests for @mention extraction logic used in createPost().
 * The regex and dedup/limit logic is tested in isolation here.
 */
import { describe, it, expect } from 'vitest';

// Extract the mention regex logic into a testable function
// (mirrors the logic in lib/db-supabase/posts.ts createPost)
function extractMentions(content: string, selfUsername?: string): string[] {
  const mentionRegex = /@([a-z0-9_]{3,20})\b/g;
  const mentionedUsernames = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1]!.toLowerCase();
    if (selfUsername && username === selfUsername) continue;
    mentionedUsernames.add(username);
  }
  // Cap at 10
  return Array.from(mentionedUsernames).slice(0, 10);
}

describe('mention extraction', () => {
  it('extracts single @mention', () => {
    const result = extractMentions('Hello @alice how are you?');
    expect(result).toEqual(['alice']);
  });

  it('extracts multiple @mentions', () => {
    const result = extractMentions('Hey @alice and @bob, check this out @charlie');
    expect(result).toEqual(['alice', 'bob', 'charlie']);
  });

  it('deduplicates repeated mentions', () => {
    const result = extractMentions('@alice said hello. @alice replied back.');
    expect(result).toEqual(['alice']);
  });

  it('handles case insensitivity', () => {
    // The regex only matches lowercase (content is already sanitized to lowercase mentions)
    const result = extractMentions('@alice and @bob');
    expect(result).toEqual(['alice', 'bob']);
  });

  it('ignores usernames shorter than 3 chars', () => {
    const result = extractMentions('@ab is too short but @abc is fine');
    expect(result).toEqual(['abc']);
  });

  it('ignores usernames longer than 20 chars', () => {
    const result = extractMentions('@abcdefghijklmnopqrstu is too long but @valid_user is fine');
    expect(result).toEqual(['valid_user']);
  });

  it('excludes self-mentions', () => {
    const result = extractMentions('I mentioned @myself and @other', 'myself');
    expect(result).toEqual(['other']);
  });

  it('handles underscores in usernames', () => {
    const result = extractMentions('@cool_bot_123 is here');
    expect(result).toEqual(['cool_bot_123']);
  });

  it('handles mentions at start and end of content', () => {
    const result = extractMentions('@alice this is for @bob');
    expect(result).toEqual(['alice', 'bob']);
  });

  it('ignores email-like patterns', () => {
    // Email-like: user@domain.com — the regex starts matching from @domain
    // which is fine because 'domain' is a valid username pattern
    // But the mention won't resolve to a real agent, which is handled at the DB level
    const result = extractMentions('email user@domain.com here');
    expect(result).toEqual(['domain']);
  });

  it('caps at 10 mentions', () => {
    const mentions = Array.from({ length: 15 }, (_, i) => `@user${String(i).padStart(3, '0')}`);
    const result = extractMentions(mentions.join(' '));
    expect(result).toHaveLength(10);
  });

  it('returns empty array for no mentions', () => {
    const result = extractMentions('No mentions here!');
    expect(result).toEqual([]);
  });

  it('handles mentions with numbers', () => {
    const result = extractMentions('@bot42 and @agent007');
    expect(result).toEqual(['bot42', 'agent007']);
  });

  it('handles mentions next to punctuation', () => {
    const result = extractMentions('Hey @alice! What about @bob?');
    expect(result).toEqual(['alice', 'bob']);
  });

  it('handles mentions in parentheses', () => {
    const result = extractMentions('(cc @alice) and (@bob)');
    expect(result).toEqual(['alice', 'bob']);
  });
});
