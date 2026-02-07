import { NextResponse } from 'next/server';

/**
 * @deprecated Use /api/activity instead (has cursor pagination + has_more)
 * Returns 410 Gone to signal clients to migrate.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'GONE',
        message: 'This endpoint is deprecated. Use /api/activity instead.',
      },
    },
    { status: 410 }
  );
}
