/**
 * Retry with Circuit Breaker for Supabase queries.
 * Process-local state (correct for Vercel serverless — each cold start resets).
 */

import { logger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  onRetry?: (error: unknown, attempt: number) => void;
}

// Circuit breaker state (module-level, process-local)
let consecutiveFailures = 0;
let lastFailureTime = 0;
let circuitOpenUntil = 0;

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_FAILURE_WINDOW_MS = 60_000;
const CIRCUIT_OPEN_DURATION_MS = 30_000;

/** Exported for testing only. */
export function _resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  lastFailureTime = 0;
  circuitOpenUntil = 0;
}

function isCircuitOpen(): boolean {
  if (circuitOpenUntil === 0) return false;
  if (Date.now() >= circuitOpenUntil) {
    // Half-open: allow next request through
    circuitOpenUntil = 0;
    return false;
  }
  return true;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  lastFailureTime = 0;
  circuitOpenUntil = 0;
}

function recordFailure(): void {
  const now = Date.now();
  if (now - lastFailureTime > CIRCUIT_FAILURE_WINDOW_MS) {
    // Outside window — reset counter
    consecutiveFailures = 1;
  } else {
    consecutiveFailures++;
  }
  lastFailureTime = now;

  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = now + CIRCUIT_OPEN_DURATION_MS;
    logger.warn(
      `Circuit breaker opened for ${CIRCUIT_OPEN_DURATION_MS}ms after ${consecutiveFailures} consecutive failures`
    );
  }
}

/**
 * Returns true if the error is transient and worth retrying.
 */
function isTransientError(err: unknown): boolean {
  // Network failures (fetch errors)
  if (err instanceof TypeError && /fetch|network|abort/i.test(err.message)) {
    return true;
  }

  // HTTP 5xx from Supabase (PostgREST wraps errors in objects with status/code)
  if (err && typeof err === 'object') {
    const status = (err as { status?: number }).status ?? (err as { code?: number }).code;
    if (typeof status === 'number' && [500, 502, 503, 504].includes(status)) {
      return true;
    }
    // Supabase timeout error messages
    const message = (err as { message?: string }).message ?? '';
    if (/timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(message)) {
      return true;
    }
  }

  if (err instanceof Error) {
    if (/timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(err.message)) {
      return true;
    }
  }

  return false;
}

/**
 * Retry wrapper with exponential backoff and circuit breaker.
 * Only retries on transient errors (network, 5xx, timeouts).
 */
export async function withRetry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 200;

  if (isCircuitOpen()) {
    throw new Error('Circuit breaker is open — request short-circuited');
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      recordSuccess();
      return result;
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts || !isTransientError(err)) {
        recordFailure();
        throw err;
      }

      opts?.onRetry?.(err, attempt);

      // Exponential backoff: 200ms → 400ms → 800ms
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but TypeScript needs it
  throw lastError;
}
