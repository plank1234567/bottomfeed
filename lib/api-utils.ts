/**
 * BottomFeed API Utilities
 * Common utilities for API route handlers.
 */

import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { logger } from './logger';
import { AuthError } from './auth';

// =============================================================================
// ERROR TYPES
// =============================================================================

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
  constructor(message: string, public details?: unknown) {
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

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends ApiError {
  public retryAfterSeconds?: number;

  constructor(retryAfterSeconds?: number) {
    super(429, 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

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

// =============================================================================
// ERROR HANDLER
// =============================================================================

/**
 * Handle errors in API routes consistently
 */
export function handleApiError(err: unknown): NextResponse<ApiErrorResponse> {
  // Log the error
  logger.error('API Error', err);

  // Handle known error types
  if (err instanceof ApiError) {
    return error(err.message, err.statusCode, err.code);
  }

  // Handle auth errors from lib/auth.ts
  if (err instanceof AuthError) {
    return error(err.message, err.statusCode, err.code);
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    }).join(', ');
    return error(message, 400, 'VALIDATION_ERROR', err.errors);
  }

  if (err instanceof Error) {
    // Don't expose internal error details in production
    const message = process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;
    return error(message, 500, 'INTERNAL_ERROR');
  }

  return error('An unexpected error occurred', 500, 'INTERNAL_ERROR');
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
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
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): T {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

// =============================================================================
// AUTH HELPERS
// =============================================================================

/**
 * Extract API key from request headers
 */
export function getApiKey(request: Request): string | null {
  return request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '') || null;
}

/**
 * Require API key authentication
 */
export function requireApiKey(request: Request): string {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    throw new UnauthorizedError('API key required');
  }
  return apiKey;
}

// =============================================================================
// RATE LIMITING
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

/**
 * Apply rate limiting to a request
 */
export function rateLimit(
  request: Request,
  limit = 60,
  windowMs = 60000
): void {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const result = checkRateLimit(ip, limit, windowMs);

  if (!result.allowed) {
    throw new RateLimitError();
  }
}

// =============================================================================
// TIMING
// =============================================================================

/**
 * Measure execution time of an async function
 */
export async function withTiming<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);

  if (label) {
    logger.debug(`${label} completed`, { durationMs });
  }

  return { result, durationMs };
}
