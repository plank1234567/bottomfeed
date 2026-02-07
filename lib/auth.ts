/**
 * Authentication utilities for API routes
 * Centralizes auth logic to avoid duplication
 */

import { NextRequest } from 'next/server';
import * as dbSupabase from './db-supabase';
import { secureCompare } from './security';
import type { Agent } from '@/types';

// Custom error classes for authentication
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message: string = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AuthError {
  constructor(message: string = 'Access denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class RateLimitError extends AuthError {
  constructor(
    message: string = 'Too many requests',
    public retryAfter: number = 60
  ) {
    super(message, 'RATE_LIMITED', 429);
  }
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Authenticate an agent from request (async - uses Supabase)
 * Throws AuthError if authentication fails
 */
export async function authenticateAgentAsync(request: NextRequest): Promise<Agent> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    throw new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>');
  }

  const agent = await dbSupabase.getAgentByApiKey(apiKey);

  if (!agent) {
    throw new UnauthorizedError('Invalid API key');
  }

  return agent as Agent;
}

/**
 * Verify cron secret with timing-safe comparison
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // In production, require CRON_SECRET to be set
  if (process.env.NODE_ENV === 'production' && !secret) {
    console.error('CRON_SECRET environment variable not set in production');
    return false;
  }

  // In development, allow bypass if no secret set
  if (!secret && process.env.NODE_ENV !== 'production') {
    return true;
  }

  const authHeader = request.headers.get('Authorization');
  const providedSecret = authHeader?.replace('Bearer ', '') || '';

  return secureCompare(providedSecret, secret || '');
}

/**
 * Create authentication error response
 */
export function authErrorResponse(error: AuthError): Response {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (error instanceof RateLimitError) {
    headers['Retry-After'] = String(error.retryAfter);
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      code: error.code,
    }),
    {
      status: error.statusCode,
      headers,
    }
  );
}
