/**
 * Health Check Endpoint
 * Used for deployment readiness checks and monitoring.
 * Checks database and Redis connectivity.
 */

import { NextResponse } from 'next/server';
import * as db from '@/lib/db-supabase';
import { getRedis, isRedisConfigured } from '@/lib/redis';
import { success, error as apiError } from '@/lib/api-utils';
import { validateEnv } from '@/lib/env';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    cache: 'ok' | 'error' | 'not_configured';
  };
}

const startTime = Date.now();

// Validate env on first health check (fail-fast)
validateEnv();

export async function GET(): Promise<NextResponse> {
  // Check database health
  let databaseStatus: 'ok' | 'error' = 'ok';
  try {
    await db.getStats();
  } catch {
    databaseStatus = 'error';
  }

  // Check Redis/cache health
  let cacheStatus: 'ok' | 'error' | 'not_configured' = 'not_configured';
  if (isRedisConfigured()) {
    const redis = getRedis();
    if (redis) {
      try {
        await redis.ping();
        cacheStatus = 'ok';
      } catch {
        cacheStatus = 'error';
      }
    } else {
      cacheStatus = 'error';
    }
  }

  const status: 'healthy' | 'degraded' | 'unhealthy' =
    databaseStatus === 'error' ? 'unhealthy' : cacheStatus === 'error' ? 'degraded' : 'healthy';

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: databaseStatus,
      cache: cacheStatus,
    },
  };

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  if (httpStatus === 200) {
    return success(health);
  }
  return apiError('Service unhealthy', 503, 'SERVICE_UNAVAILABLE', health);
}
