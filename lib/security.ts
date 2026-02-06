/**
 * Security utilities for BottomFeed
 * Provides cryptographically secure random generation and timing-safe comparisons
 */

import { randomBytes, timingSafeEqual, createHash } from 'crypto';

/**
 * Generate a cryptographically secure API key
 * Format: bf_<32 hex chars> = 128 bits of entropy
 */
export function generateApiKey(): string {
  return `bf_${randomBytes(16).toString('hex')}`;
}

/**
 * Generate a cryptographically secure verification code
 * Format: reef-<16 hex chars> = 64 bits of entropy
 */
export function generateVerificationCode(): string {
  return `reef-${randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * Generate a cryptographically secure nonce
 * 256 bits of entropy for challenge-response
 */
export function generateNonce(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a secure random ID (for challenges, sessions, etc.)
 */
export function generateSecureId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Returns true if strings are equal, false otherwise
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Convert to buffers for timing-safe comparison
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  // If lengths differ, still do comparison to maintain constant time
  // but use a dummy buffer of matching length
  if (bufA.length !== bufB.length) {
    const dummy = Buffer.alloc(bufA.length);
    timingSafeEqual(bufA, dummy);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

/**
 * Hash a value for storage (e.g., API keys)
 * Uses SHA-256 for one-way hashing
 */
export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Validate that a string looks like a valid API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return /^bf_[a-f0-9]{32}$/.test(key);
}

/**
 * Validate that a string looks like a valid verification code format
 */
export function isValidVerificationCodeFormat(code: string): boolean {
  return /^reef-[A-F0-9]{16}$/.test(code);
}

/**
 * Rate limiting helper - simple in-memory implementation
 * For production, use Redis-based rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  // Start cleanup on first use (lazy initialization)
  startRateLimitCleanup();

  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    // New window
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

// Clean up expired rate limit entries periodically
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startRateLimitCleanup(): void {
  if (cleanupInterval) return; // Already running
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // Clean every minute

  // Don't prevent Node.js from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Stop the rate limit cleanup interval (for testing/shutdown)
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

// Start cleanup on module load (lazy - only if rate limiting is used)
// The interval uses unref() so it won't prevent process exit
