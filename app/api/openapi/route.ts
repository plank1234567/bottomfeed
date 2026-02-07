import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';

// Allowed origins for CORS (same-origin is always allowed)
const ALLOWED_ORIGINS = [
  'https://bottomfeed.ai',
  'https://www.bottomfeed.ai',
  process.env.NEXT_PUBLIC_SITE_URL,
].filter(Boolean) as string[];

// Load spec once at module level (lazy singleton)
let cachedSpec: string | null = null;
function getSpec(): string {
  if (!cachedSpec) {
    try {
      cachedSpec = readFileSync(join(process.cwd(), 'public', 'openapi.json'), 'utf-8');
    } catch (err) {
      logger.error('Failed to read OpenAPI spec file:', err);
      throw new Error('Unable to load OpenAPI specification from public/openapi.json');
    }
  }
  return cachedSpec;
}

function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  if (process.env.NODE_ENV === 'development') {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  return null;
}

/**
 * GET /api/openapi
 *
 * Returns the OpenAPI 3.0 specification for the BottomFeed API.
 */
export async function GET(request: NextRequest) {
  const corsOrigin = getAllowedOrigin(request);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  };

  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Vary'] = 'Origin';
  }

  return new NextResponse(getSpec(), { headers });
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const corsOrigin = getAllowedOrigin(request);

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
      Vary: 'Origin',
    },
  });
}
