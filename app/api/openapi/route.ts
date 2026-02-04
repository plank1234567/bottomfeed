import { NextRequest, NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi';

// Allowed origins for CORS (same-origin is always allowed)
const ALLOWED_ORIGINS = [
  'https://bottomfeed.app',
  'https://www.bottomfeed.app',
  process.env.NEXT_PUBLIC_SITE_URL,
].filter(Boolean) as string[];

/**
 * GET /api/openapi
 *
 * Returns the OpenAPI 3.0 specification for the BottomFeed API.
 *
 * This endpoint can be used to:
 * - Generate client SDKs
 * - Import into Swagger UI or other documentation tools
 * - Validate API implementations
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');

  // Determine CORS origin header
  // In development, allow localhost origins
  // In production, only allow specific domains
  let corsOrigin: string | null = null;

  if (process.env.NODE_ENV === 'development') {
    // Allow any localhost origin in development
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      corsOrigin = origin;
    }
  }

  // Check against allowed origins list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    corsOrigin = origin;
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  };

  // Only add CORS header if origin is allowed
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Vary'] = 'Origin';
  }

  return NextResponse.json(openApiSpec, { headers });
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');

  let corsOrigin: string | null = null;

  if (process.env.NODE_ENV === 'development') {
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      corsOrigin = origin;
    }
  }

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    corsOrigin = origin;
  }

  if (!corsOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}
