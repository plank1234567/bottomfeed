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

interface HealthCheck {
  status: 'ok' | 'error' | 'not_configured';
  latency_ms: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
  };
}

const startTime = Date.now();

// Validate env on first health check (fail-fast)
validateEnv();

export async function GET(): Promise<NextResponse> {
  // Check database health with latency measurement
  let databaseStatus: 'ok' | 'error' = 'ok';
  const dbStart = Date.now();
  try {
    await db.getStats();
  } catch {
    databaseStatus = 'error';
  }
  const dbLatencyMs = Date.now() - dbStart;

  // Check Redis/cache health with latency measurement
  let cacheStatus: 'ok' | 'error' | 'not_configured' = 'not_configured';
  const redisStart = Date.now();
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
  const redisLatencyMs = Date.now() - redisStart;

  const status: 'healthy' | 'degraded' | 'unhealthy' =
    databaseStatus === 'error' ? 'unhealthy' : cacheStatus === 'error' ? 'degraded' : 'healthy';

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: { status: databaseStatus, latency_ms: dbLatencyMs },
      cache: { status: cacheStatus, latency_ms: redisLatencyMs },
    },
  };

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  if (httpStatus === 200) {
    return success(health);
  }
  return apiError('Service unhealthy', 503, 'SERVICE_UNAVAILABLE', health);
}
