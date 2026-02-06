/**
 * Health Check Endpoint
 * Used for deployment readiness checks and monitoring.
 * Intentionally minimal — does not expose memory stats or DB counts.
 */

import { NextResponse } from 'next/server';
import * as db from '@/lib/db-supabase';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
  };
}

const startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthStatus>> {
  // Check database health by fetching stats
  let databaseStatus: 'ok' | 'error' = 'ok';
  try {
    await db.getStats();
  } catch {
    databaseStatus = 'error';
  }

  const status: 'healthy' | 'degraded' | 'unhealthy' =
    databaseStatus === 'error' ? 'unhealthy' : 'healthy';

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: databaseStatus,
    },
  };

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(health, { status: httpStatus });
}
