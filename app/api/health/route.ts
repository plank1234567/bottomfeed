/**
 * Health Check Endpoint
 * Used for deployment readiness checks and monitoring.
 * Checks database and Redis connectivity with per-check timeouts.
 */

import { NextResponse } from 'next/server';
import * as db from '@/lib/db-supabase';
import { getRedis, isRedisConfigured } from '@/lib/redis';
import { success, error as apiError } from '@/lib/api-utils';
import { validateEnv } from '@/lib/env';
import { sendAlert } from '@/lib/alerting';
import { getResilienceMetrics } from '@/lib/resilience';

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
  metrics: {
    retry_count: number;
    retry_success_count: number;
    circuit_open_count: number;
    circuit_currently_open: boolean;
  };
}

const startTime = Date.now();
const CHECK_TIMEOUT_MS = 5_000;

// Track last status for transition alerts
let lastStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

// Validate env on first health check (fail-fast)
validateEnv();

/**
 * Race a promise against a timeout. Returns the result or throws on timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Health check timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function GET(): Promise<NextResponse> {
  // Check database health with latency measurement and timeout
  let databaseStatus: 'ok' | 'error' = 'ok';
  const dbStart = Date.now();
  try {
    await withTimeout(db.getStats(), CHECK_TIMEOUT_MS);
  } catch {
    databaseStatus = 'error';
  }
  const dbLatencyMs = Date.now() - dbStart;

  // Check Redis/cache health with latency measurement and timeout
  let cacheStatus: 'ok' | 'error' | 'not_configured' = 'not_configured';
  const redisStart = Date.now();
  if (isRedisConfigured()) {
    const redis = getRedis();
    if (redis) {
      try {
        await withTimeout(redis.ping(), CHECK_TIMEOUT_MS);
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

  // Alert on status transitions (healthy → degraded/unhealthy)
  if (status !== lastStatus) {
    if (status === 'unhealthy') {
      sendAlert({
        level: 'critical',
        title: 'Service unhealthy',
        details: `Database: ${databaseStatus}, Cache: ${cacheStatus}`,
        source: 'health',
      });
    } else if (status === 'degraded') {
      sendAlert({
        level: 'warn',
        title: 'Service degraded',
        details: `Database: ${databaseStatus}, Cache: ${cacheStatus}`,
        source: 'health',
      });
    } else if (lastStatus !== 'healthy') {
      sendAlert({
        level: 'info',
        title: 'Service recovered',
        details: `Previous status: ${lastStatus}`,
        source: 'health',
      });
    }
    lastStatus = status;
  }

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: { status: databaseStatus, latency_ms: dbLatencyMs },
      cache: { status: cacheStatus, latency_ms: redisLatencyMs },
    },
    metrics: getResilienceMetrics(),
  };

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  if (httpStatus === 200) {
    return success(health);
  }
  return apiError('Service unhealthy', 503, 'SERVICE_UNAVAILABLE', health);
}
