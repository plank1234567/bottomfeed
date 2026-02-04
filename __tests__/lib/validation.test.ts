/**
 * Validation Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  usernameSchema,
  registerAgentSchema,
  createPostSchema,
  createPollSchema,
  searchSchema,
  validate,
  safeValidate,
  formatZodError,
} from '@/lib/validation';

describe('usernameSchema', () => {
  it('accepts valid usernames', () => {
    expect(() => usernameSchema.parse('claude')).not.toThrow();
    expect(() => usernameSchema.parse('gpt_4')).not.toThrow();
    expect(() => usernameSchema.parse('agent123')).not.toThrow();
  });

  it('rejects usernames that are too short', () => {
    expect(() => usernameSchema.parse('ab')).toThrow();
  });

  it('rejects usernames that are too long', () => {
    expect(() => usernameSchema.parse('a'.repeat(21))).toThrow();
  });

  it('rejects usernames with invalid characters', () => {
    expect(() => usernameSchema.parse('User Name')).toThrow();
    expect(() => usernameSchema.parse('user@name')).toThrow();
    expect(() => usernameSchema.parse('USER')).toThrow(); // uppercase
  });
});

describe('registerAgentSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerAgentSchema.parse({
      name: 'Test Agent',
      description: 'A test agent',
    });
    expect(result.name).toBe('Test Agent');
    expect(result.description).toBe('A test agent');
  });

  it('provides default description', () => {
    const result = registerAgentSchema.parse({ name: 'Test Agent' });
    expect(result.description).toBe('');
  });

  it('rejects empty name', () => {
    expect(() => registerAgentSchema.parse({ name: '' })).toThrow();
  });

  it('rejects name that is too long', () => {
    expect(() => registerAgentSchema.parse({ name: 'a'.repeat(51) })).toThrow();
  });
});

describe('createPostSchema', () => {
  it('accepts valid post data', () => {
    const result = createPostSchema.parse({
      content: 'Hello, world!',
    });
    expect(result.content).toBe('Hello, world!');
    expect(result.post_type).toBe('post');
    expect(result.media_urls).toEqual([]);
  });

  it('accepts post with metadata', () => {
    const result = createPostSchema.parse({
      content: 'Test post',
      metadata: {
        reasoning: 'Testing',
        confidence: 0.9,
      },
    });
    expect(result.metadata?.reasoning).toBe('Testing');
    expect(result.metadata?.confidence).toBe(0.9);
  });

  it('rejects empty content', () => {
    expect(() => createPostSchema.parse({ content: '' })).toThrow();
  });

  it('rejects content that is too long', () => {
    expect(() => createPostSchema.parse({ content: 'a'.repeat(4001) })).toThrow();
  });

  it('rejects invalid reply_to_id format', () => {
    expect(() => createPostSchema.parse({
      content: 'Reply',
      reply_to_id: 'not-a-uuid',
    })).toThrow();
  });
});

describe('createPollSchema', () => {
  it('accepts valid poll data', () => {
    const result = createPollSchema.parse({
      question: 'What is your favorite color?',
      options: ['Red', 'Blue', 'Green'],
    });
    expect(result.question).toBe('What is your favorite color?');
    expect(result.options).toHaveLength(3);
    expect(result.expires_in_hours).toBe(24);
  });

  it('rejects poll with too few options', () => {
    expect(() => createPollSchema.parse({
      question: 'Test?',
      options: ['Only one'],
    })).toThrow();
  });

  it('rejects poll with too many options', () => {
    expect(() => createPollSchema.parse({
      question: 'Test?',
      options: ['A', 'B', 'C', 'D', 'E'],
    })).toThrow();
  });
});

describe('searchSchema', () => {
  it('accepts valid search query', () => {
    const result = searchSchema.parse({
      q: 'test query',
    });
    expect(result.q).toBe('test query');
    expect(result.type).toBe('all');
    expect(result.limit).toBe(50);
  });

  it('accepts search with type filter', () => {
    const result = searchSchema.parse({
      q: 'test',
      type: 'agents',
      limit: 10,
    });
    expect(result.type).toBe('agents');
    expect(result.limit).toBe(10);
  });

  it('rejects query that is too short', () => {
    expect(() => searchSchema.parse({ q: 'a' })).toThrow();
  });
});

describe('helper functions', () => {
  describe('validate', () => {
    it('returns data on success', () => {
      const result = validate(usernameSchema, 'validuser');
      expect(result).toBe('validuser');
    });

    it('throws on invalid data', () => {
      expect(() => validate(usernameSchema, '')).toThrow();
    });
  });

  describe('safeValidate', () => {
    it('returns success result on valid data', () => {
      const result = safeValidate(usernameSchema, 'validuser');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('validuser');
      }
    });

    it('returns error result on invalid data', () => {
      const result = safeValidate(usernameSchema, '');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('formatZodError', () => {
    it('formats errors correctly', () => {
      const result = safeValidate(createPostSchema, { content: '' });
      if (!result.success) {
        const message = formatZodError(result.error);
        expect(message).toContain('content');
      }
    });
  });
});
