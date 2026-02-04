/**
 * BottomFeed Request Middleware
 * Provides request logging, rate limiting, and security for all API routes.
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// CONFIGURATION
// =============================================================================

const RATE_LIMIT_CONFIG = {
  // General API endpoints: 100 requests per minute
  default: { limit: 100, windowMs: 60000 },
  // Write operations (POST/PUT/DELETE): 30 per minute
  write: { limit: 30, windowMs: 60000 },
  // Auth-related endpoints: 10 per minute (stricter)
  auth: { limit: 10, windowMs: 60000 },
  // Search: 60 per minute
  search: { limit: 60, windowMs: 60000 },
};

// Maximum request body size in bytes (1MB)
const MAX_BODY_SIZE = 1 * 1024 * 1024;

// =============================================================================
// RATE LIMITING
// =============================================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || record.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

function getRateLimitConfig(pathname: string, method: string) {
  // Auth endpoints - strictest limits
  if (
    pathname.includes('/register') ||
    pathname.includes('/claim') ||
    pathname.includes('/verify')
  ) {
    return RATE_LIMIT_CONFIG.auth;
  }
  // Search endpoints
  if (pathname.includes('/search')) {
    return RATE_LIMIT_CONFIG.search;
  }
  // Write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return RATE_LIMIT_CONFIG.write;
  }
  // Default for GET requests
  return RATE_LIMIT_CONFIG.default;
}

// =============================================================================
// REQUEST METRICS
// =============================================================================

interface RequestMetrics {
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

function logRequest(metrics: RequestMetrics): void {
  const logLevel = metrics.status >= 500 ? 'ERROR' : metrics.status >= 400 ? 'WARN' : 'INFO';

  console.log(
    JSON.stringify({
      level: logLevel,
      type: 'request',
      ...metrics,
    })
  );
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Middleware function for request processing
 */
export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and non-API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    !pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  const clientIp = getClientIp(request);

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================
  const rateLimitConfig = getRateLimitConfig(pathname, request.method);
  const rateLimitKey = `${clientIp}:${pathname.split('/').slice(0, 4).join('/')}`;
  const rateLimitResult = checkRateLimit(
    rateLimitKey,
    rateLimitConfig.limit,
    rateLimitConfig.windowMs
  );

  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rateLimitConfig.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetAt / 1000)),
        },
      }
    );
  }

  // ==========================================================================
  // BODY SIZE LIMIT (for POST/PUT/PATCH requests)
  // ==========================================================================
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body exceeds maximum size of ${MAX_BODY_SIZE / 1024 / 1024}MB`,
          },
        },
        { status: 413 }
      );
    }
  }

  // Process the request
  const response = NextResponse.next();

  // Calculate duration and log metrics
  const duration = Math.round(performance.now() - startTime);

  // Log API request metrics (async, non-blocking)
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_REQUEST_LOGGING === 'true') {
    logRequest({
      method: request.method,
      path: pathname,
      status: response.status,
      duration,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
      ip: getClientIp(request),
    });
  }

  // Add timing header for debugging
  response.headers.set('X-Response-Time', `${duration}ms`);

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.limit));
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)));

  // Add security headers for API routes
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.twitter.com https://api.x.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

/**
 * Middleware configuration
 * Only run on API routes for performance
 */
export const config = {
  matcher: '/api/:path*',
};
