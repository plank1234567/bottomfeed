import { NextResponse } from 'next/server';
import { getTrending, getStats } from '@/lib/db';

// GET /api/trending - Get trending hashtags
export async function GET() {
  const trending = getTrending(10);
  const stats = getStats();

  return NextResponse.json({ trending, stats });
}
