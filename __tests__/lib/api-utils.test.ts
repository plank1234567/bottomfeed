/**
 * API Utilities Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  success,
  error,
  handleApiError,
  parseLimit,
} from '@/lib/api-utils';
import { extractApiKey } from '@/lib/auth';
import { ZodError, z } from 'zod';
import { NextRequest } from 'next/server';

describe('Error Classes', () => {
  describe('ApiError', () => {
    it('creates an error with status code and message', () => {
      const err = new ApiError(400, 'Bad request', 'BAD_REQUEST');
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Bad request');
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.name).toBe('ApiError');
    });
  });

  describe('ValidationError', () => {
    it('creates a 400 error', () => {
      const err = new ValidationError('Invalid input');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('includes details', () => {
      const err = new ValidationError('Invalid input', { field: 'email' });
      expect(err.details).toEqual({ field: 'email' });
    });
  });

  describe('NotFoundError', () => {
    it('creates a 404 error with resource name', () => {
      const err = new NotFoundError('Post');
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Post not found');
      expect(err.code).toBe('NOT_FOUND');
    });
  });

  describe('UnauthorizedError', () => {
    it('creates a 401 error', () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe('Authentication required');
    });

    it('accepts custom message', () => {
      const err = new UnauthorizedError('Token expired');
      expect(err.message).toBe('Token expired');
    });
  });

  describe('ForbiddenError', () => {
    it('creates a 403 error', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('Access denied');
    });
  });

  describe('RateLimitError', () => {
    it('creates a 429 error', () => {
      const err = new RateLimitError();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMITED');
    });
  });
});

describe('Response Helpers', () => {
  describe('success', () => {
    it('creates a success response with data', async () => {
      const response = success({ id: 1, name: 'Test' });
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toEqual({ id: 1, name: 'Test' });
      expect(response.status).toBe(200);
    });

    it('accepts custom status code', async () => {
      const response = success({ created: true }, 201);
      expect(response.status).toBe(201);
    });
  });

  describe('error', () => {
    it('creates an error response', async () => {
      const response = error('Something went wrong', 500, 'INTERNAL_ERROR');
      const json = await response.json();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_ERROR');
      expect(json.error.message).toBe('Something went wrong');
      expect(response.status).toBe(500);
    });

    it('includes details when provided', async () => {
      const response = error('Validation failed', 400, 'VALIDATION_ERROR', { field: 'email' });
      const json = await response.json();

      expect(json.error.details).toEqual({ field: 'email' });
    });
  });
});

describe('handleApiError', () => {
  it('handles ApiError', async () => {
    const err = new NotFoundError('User');
    const response = handleApiError(err);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error.message).toBe('User not found');
  });

  it('handles ZodError', async () => {
    const schema = z.object({ email: z.string().email() });
    let zodError: ZodError | null = null;

    try {
      schema.parse({ email: 'invalid' });
    } catch (err) {
      zodError = err as ZodError;
    }

    const response = handleApiError(zodError);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles generic Error', async () => {
    const err = new Error('Something broke');
    const response = handleApiError(err);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error.code).toBe('INTERNAL_ERROR');
  });

  it('handles unknown error types', async () => {
    const response = handleApiError('string error');
    const json = await response.json();

    expect(response.status).toBe(500);
  });
});

describe('parseLimit', () => {
  function makeParams(params: Record<string, string> = {}): URLSearchParams {
    return new URLSearchParams(params);
  }

  it('returns default when limit is not provided', () => {
    expect(parseLimit(makeParams())).toBe(50); // DEFAULT_PAGE_SIZE
  });

  it('parses a valid limit', () => {
    expect(parseLimit(makeParams({ limit: '20' }))).toBe(20);
  });

  it('clamps to max', () => {
    expect(parseLimit(makeParams({ limit: '999' }))).toBe(100); // MAX_PAGE_SIZE
  });

  it('returns default for NaN', () => {
    expect(parseLimit(makeParams({ limit: 'abc' }))).toBe(50);
  });

  it('returns default for negative values', () => {
    expect(parseLimit(makeParams({ limit: '-5' }))).toBe(50);
  });

  it('returns default for zero', () => {
    expect(parseLimit(makeParams({ limit: '0' }))).toBe(50);
  });

  it('accepts custom default and max', () => {
    expect(parseLimit(makeParams(), 20, 50)).toBe(20);
    expect(parseLimit(makeParams({ limit: '100' }), 20, 50)).toBe(50);
  });

  it('returns 1 when limit is 1', () => {
    expect(parseLimit(makeParams({ limit: '1' }))).toBe(1);
  });
});

describe('Auth Helpers', () => {
  describe('extractApiKey', () => {
    it('extracts API key from Authorization Bearer header', () => {
      const request = new NextRequest('http://localhost', {
        headers: { Authorization: 'Bearer bf_test_key' },
      });
      expect(extractApiKey(request)).toBe('bf_test_key');
    });

    it('returns null when no Authorization header present', () => {
      const request = new NextRequest('http://localhost');
      expect(extractApiKey(request)).toBeNull();
    });

    it('returns null when Authorization header is not Bearer', () => {
      const request = new NextRequest('http://localhost', {
        headers: { Authorization: 'Basic abc123' },
      });
      expect(extractApiKey(request)).toBeNull();
    });
  });
});
