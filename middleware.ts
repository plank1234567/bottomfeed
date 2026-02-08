/**
 * BottomFeed Request Middleware
 * Provides request logging, rate limiting, security headers, and nonce-based CSP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/ip';
import { MAX_BODY_SIZE } from '@/lib/constants';

// CONFIGURATION

// Per-IP rate limits. Reads are generous (100/min) to support feed polling.
// Writes are capped lower (30/min) since agents post infrequently.
// Auth is strictest (10/min) to limit brute-force attempts.
const RATE_LIMIT_CONFIG = {
  default: { limit: 100, windowMs: 60000 },
  write: { limit: 30, windowMs: 60000 },
  auth: { limit: 10, windowMs: 60000 },
  search: { limit: 60, windowMs: 60000 },
};

// RATE LIMITING (Upstash Redis with in-memory fallback)

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

// REQUEST METRICS

interface RequestMetrics {
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
  requestId: string;
  userAgent?: string;
  ip?: string;
}

function logRequest(metrics: RequestMetrics): void {
  const logLevel = metrics.status >= 500 ? 'error' : metrics.status >= 400 ? 'warn' : 'info';

  // Middleware runs in Edge Runtime where lib/logger is not available.
  // Use structured JSON to stdout for log aggregators.
  const logFn =
    logLevel === 'error' ? console.error : logLevel === 'warn' ? console.warn : console.info;
  logFn(
    JSON.stringify({
      level: logLevel,
      type: 'request',
      ...metrics,
    })
  );
}

// getClientIp imported from @/lib/ip

// CSP NONCE GENERATION

/**
 * Generate a cryptographically random nonce for Content Security Policy.
 * Uses crypto.randomUUID() which is available in Edge Runtime.
 */
function generateNonce(): string {
  // crypto.randomUUID() produces a v4 UUID; convert to base64 for a compact nonce
  const uuid = crypto.randomUUID();
  // Use the hex digits of the UUID (without dashes) as the nonce value
  return uuid.replace(/-/g, '');
}

/**
 * Build the Content-Security-Policy header value.
 * In production, uses nonce-based script-src with strict-dynamic.
 * In development, uses unsafe-inline + unsafe-eval for Next.js Fast Refresh.
 */
function buildCspHeader(nonce: string): string {
  // In development, Next.js requires unsafe-inline and unsafe-eval for
  // Fast Refresh / hot module replacement. Nonce-based CSP breaks HMR.
  const scriptSrc =
    process.env.NODE_ENV === 'production'
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'unsafe-inline' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.twitter.com https://api.x.com https://*.ingest.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Apply security headers to a response, including nonce-based CSP.
 */
function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce));
}

/**
 * Middleware function for request processing.
 * Handles nonce-based CSP for all routes and rate limiting for API routes.
 */
export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const { pathname } = request.nextUrl;

  // Generate a fresh nonce for every request (used in CSP header)
  const nonce = generateNonce();

  // Generate or propagate X-Request-ID for request correlation
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  // Skip rate limiting / body-size checks for static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // PAGE ROUTES (non-API): apply CSP + security headers and pass nonce
  if (!pathname.startsWith('/api')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('x-request-id', requestId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    applySecurityHeaders(response, nonce);
    response.headers.set('X-Request-ID', requestId);
    return response;
  }

  // API ROUTES: rate limiting, body size, security headers

  const clientIp = getClientIp(request);

  // RATE LIMITING (skip for health endpoint so monitoring services aren't throttled)
  if (pathname === '/api/health') {
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    });
    applySecurityHeaders(response, nonce);
    response.headers.set('X-Request-ID', requestId);
    return response;
  }

  const rateLimitConfig = getRateLimitConfig(pathname, request.method);
  // Use method + route prefix as key. Auth-tier endpoints share a single key
  // so attackers can't bypass limits by hitting different auth endpoints.
  const isAuthTier = rateLimitConfig === RATE_LIMIT_CONFIG.auth;
  const routeKey = isAuthTier
    ? 'auth'
    : `${request.method}:${pathname.split('/').slice(0, 4).join('/')}`;
  const rateLimitKey = `${clientIp}:${routeKey}`;
  const rateLimitResult = await checkRateLimit(
    rateLimitKey,
    rateLimitConfig.limit,
    rateLimitConfig.windowMs,
    'middleware'
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
          'X-Request-ID': requestId,
        },
      }
    );
  }

  // BODY SIZE LIMIT (for POST/PUT/PATCH requests)
  // NOTE: This only checks Content-Length. Chunked transfer encoding
  // (Transfer-Encoding: chunked) may bypass this check since no
  // Content-Length header is sent. Next.js/Vercel enforce their own
  // body limits, but for self-hosted deployments ensure the reverse
  // proxy also enforces a body size limit.
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

  // Process the request — pass nonce + request ID via request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
      requestId,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: getClientIp(request),
    });
  }

  // Add timing, version, and request ID headers
  response.headers.set('X-Response-Time', `${duration}ms`);
  response.headers.set('X-API-Version', '1');
  response.headers.set('X-Request-ID', requestId);

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.limit));
  response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)));

  // Security headers — single source of truth (not duplicated in next.config.js)
  applySecurityHeaders(response, nonce);

  // Cache-Control: allow short caching for read-only, public GET endpoints
  if (request.method === 'GET') {
    if (pathname === '/api/trending' || pathname === '/api/posts/trending') {
      response.headers.set('Cache-Control', 'public, max-age=30');
    } else if (pathname === '/api/agents' && !request.nextUrl.searchParams.has('q')) {
      response.headers.set('Cache-Control', 'public, max-age=15');
    } else {
      response.headers.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
  } else {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

/**
 * Middleware configuration
 * Run on API routes (rate limiting + CSP) and page routes (CSP nonce).
 * Excludes static assets, images, and favicon for performance.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
