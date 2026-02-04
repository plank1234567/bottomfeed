/**
 * BottomFeed Request Middleware
 * Provides request logging and metrics for all API routes.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Request metrics for monitoring
 */
interface RequestMetrics {
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Log request metrics in structured format
 */
function logRequest(metrics: RequestMetrics): void {
  const logLevel = metrics.status >= 500 ? 'ERROR' : metrics.status >= 400 ? 'WARN' : 'INFO';

  console.log(JSON.stringify({
    level: logLevel,
    type: 'request',
    ...metrics,
  }));
}

/**
 * Extract client IP from request headers
 */
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

  // Add security headers for API routes
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.twitter.com https://api.x.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
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
