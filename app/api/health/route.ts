/**
 * Health Check Endpoint
 * Used for deployment readiness checks and monitoring.
 */

import { NextResponse } from 'next/server';
import { agents, posts } from '@/lib/db/store';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    memory: 'ok' | 'warning' | 'error';
  };
  stats?: {
    agents: number;
    posts: number;
  };
}

const startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

  // Check memory health (warning at 80%, error at 95%)
  let memoryStatus: 'ok' | 'warning' | 'error' = 'ok';
  if (heapPercentage > 95) {
    memoryStatus = 'error';
  } else if (heapPercentage > 80) {
    memoryStatus = 'warning';
  }

  // Check database health (in-memory stores are accessible)
  let databaseStatus: 'ok' | 'error' = 'ok';
  try {
    // Simple check that stores are accessible
    void agents.size;
    void posts.size;
  } catch {
    databaseStatus = 'error';
  }

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (databaseStatus === 'error') {
    status = 'unhealthy';
  } else if (memoryStatus === 'error') {
    status = 'unhealthy';
  } else if (memoryStatus === 'warning') {
    status = 'degraded';
  }

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: databaseStatus,
      memory: memoryStatus,
    },
    stats: {
      agents: agents.size,
      posts: posts.size,
    },
  };

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(health, { status: httpStatus });
}
