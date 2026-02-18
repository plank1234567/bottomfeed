/**
 * BottomFeed API Utilities
 * Common utilities for API route handlers.
 */

import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';
import { AuthError, UnauthorizedError, ForbiddenError, RateLimitError } from './auth';

// Re-export auth error classes for backward compatibility
export { UnauthorizedError, ForbiddenError, RateLimitError };

// ERROR TYPES

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// RESPONSE HELPERS

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Create a success response
 */
export function success<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create an error response
 */
export function error(
  message: string,
  status = 500,
  code = 'INTERNAL_ERROR',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    errorResponse.error.details = details;
  }

  return NextResponse.json(errorResponse, { status });
}

// ERROR HANDLER

/**
 * Handle errors in API routes consistently
 */
export function handleApiError(err: unknown): NextResponse<ApiErrorResponse> {
  // Log the error
  logger.error('API Error', err);

  // Enrich Sentry with error context
  if (process.env.NODE_ENV === 'production') {
    Sentry.withScope(scope => {
      if (err instanceof ApiError) {
        scope.setTag('error.code', err.code || 'unknown');
        scope.setTag('error.status', String(err.statusCode));
      } else if (err instanceof AuthError) {
        scope.setTag('error.code', err.code);
        scope.setTag('error.status', String(err.statusCode));
        scope.setTag('error.type', 'auth');
      }
      if (err instanceof Error) {
        Sentry.captureException(err);
      }
    });
  }

  // Handle known error types
  if (err instanceof ApiError) {
    return error(err.message, err.statusCode, err.code);
  }

  // Handle auth errors from lib/auth.ts
  if (err instanceof AuthError) {
    return error(err.message, err.statusCode, err.code);
  }

  // Handle malformed JSON body (request.json() throws SyntaxError)
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return error('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  if (err instanceof ZodError) {
    const details = process.env.NODE_ENV === 'production' ? undefined : err.errors;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Validation failed'
        : err.errors
            .map(e => {
              const path = e.path.join('.');
              return path ? `${path}: ${e.message}` : e.message;
            })
            .join(', ');
    return error(message, 400, 'VALIDATION_ERROR', details);
  }

  if (err instanceof Error) {
    // Don't expose internal error details in production
    const message =
      process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message;
    return error(message, 500, 'INTERNAL_ERROR');
  }

  return error('An unexpected error occurred', 500, 'INTERNAL_ERROR');
}

// VALIDATION HELPERS

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw err;
    }
    throw new ValidationError('Invalid JSON body');
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(searchParams: URLSearchParams, schema: ZodSchema<T>): T {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

// UUID VALIDATION

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(value: string, label = 'ID'): void {
  if (!UUID_REGEX.test(value)) {
    throw new ValidationError(`Invalid ${label} format`);
  }
}

// QUERY PARAM HELPERS

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants';

/**
 * Parse a `limit` query parameter with safe defaults and clamping.
 * @param searchParams - The URL search params
 * @param defaultLimit - Fallback if missing/invalid (default: DEFAULT_PAGE_SIZE)
 * @param maxLimit - Upper clamp (default: MAX_PAGE_SIZE)
 */
export function parseLimit(
  searchParams: URLSearchParams,
  defaultLimit = DEFAULT_PAGE_SIZE,
  maxLimit = MAX_PAGE_SIZE
): number {
  const raw = searchParams.get('limit');
  if (raw == null) return defaultLimit;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

// CURSOR HELPERS
// Pipe separator chosen because it doesn't appear in ISO timestamps or UUIDs.
// Legacy clients might still send plain timestamps (pre-composite), so decodeCursor handles both.

const CURSOR_SEPARATOR = '|';

/**
 * Encode a composite cursor from a timestamp and ID.
 * Format: "created_at|id" — prevents skipping records with identical timestamps.
 */
export function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}${CURSOR_SEPARATOR}${id}`;
}

/**
 * Decode a composite cursor. Supports both new format ("timestamp|id")
 * and legacy format (plain timestamp) for backwards compatibility.
 */
export function decodeCursor(cursor: string): { createdAt: string; id: string | null } {
  const sepIdx = cursor.indexOf(CURSOR_SEPARATOR);
  if (sepIdx === -1) {
    return { createdAt: cursor, id: null };
  }
  return {
    createdAt: cursor.substring(0, sepIdx),
    id: cursor.substring(sepIdx + 1),
  };
}

// TIMING
