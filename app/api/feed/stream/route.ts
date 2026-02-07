import { NextRequest, NextResponse } from 'next/server';
import { subscribeToNewPosts } from '@/lib/feed-pubsub';
import { getRedis } from '@/lib/redis';
import type { Post } from '@/types';

export const dynamic = 'force-dynamic';

// Per-IP concurrent connection tracking to prevent DoS
const MAX_SSE_CONNECTIONS_PER_IP = 5;
const MAX_SSE_CONNECTIONS_TOTAL = 200;

// In-memory fallback when Redis is unavailable
const memConnectionCounts = new Map<string, number>();
let memTotalConnections = 0;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function getConnectionCount(ip: string): Promise<{ perIp: number; total: number }> {
  const redis = getRedis();
  if (redis) {
    try {
      const [perIp, total] = await Promise.all([
        redis.get<number>(`sse:ip:${ip}`),
        redis.get<number>('sse:total'),
      ]);
      return { perIp: perIp ?? 0, total: total ?? 0 };
    } catch {
      // Fallback to in-memory
    }
  }
  return { perIp: memConnectionCounts.get(ip) || 0, total: memTotalConnections };
}

async function incrementConnection(ip: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await Promise.all([
        redis.incr(`sse:ip:${ip}`),
        redis.incr('sse:total'),
        // Auto-expire per-IP keys after 10 minutes (stale connection cleanup)
        redis.expire(`sse:ip:${ip}`, 600),
      ]);
      return;
    } catch {
      // Fallback to in-memory
    }
  }
  memConnectionCounts.set(ip, (memConnectionCounts.get(ip) || 0) + 1);
  memTotalConnections++;
}

async function decrementConnection(ip: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await Promise.all([redis.decr(`sse:ip:${ip}`), redis.decr('sse:total')]);
      return;
    } catch {
      // Fallback to in-memory
    }
  }
  const count = memConnectionCounts.get(ip) || 1;
  if (count <= 1) {
    memConnectionCounts.delete(ip);
  } else {
    memConnectionCounts.set(ip, count - 1);
  }
  memTotalConnections = Math.max(0, memTotalConnections - 1);
}

// GET /api/feed/stream - Server-Sent Events endpoint for real-time feed updates
export async function GET(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);

  const { perIp, total } = await getConnectionCount(ip);

  // Check global connection limit
  if (total >= MAX_SSE_CONNECTIONS_TOTAL) {
    return NextResponse.json(
      { success: false, error: { code: 'CONNECTION_LIMIT', message: 'Too many connections' } },
      { status: 503 }
    );
  }

  // Check per-IP connection limit
  if (perIp >= MAX_SSE_CONNECTIONS_PER_IP) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CONNECTION_LIMIT', message: 'Too many connections from this IP' },
      },
      { status: 429 }
    );
  }

  // Track connection
  await incrementConnection(ip);

  const encoder = new TextEncoder();

  // Cleanup function reference — set inside start(), called inside cancel()
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial comment to confirm the connection is alive
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Heartbeat every 30 seconds to keep the connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // Stream was closed; the cancel callback will handle full cleanup
          clearInterval(heartbeatInterval);
        }
      }, 30_000);

      // Subscribe to new posts via the in-memory pub/sub
      const unsubscribe = subscribeToNewPosts((post: Post) => {
        try {
          const data = JSON.stringify(post);
          controller.enqueue(encoder.encode(`event: new-post\ndata: ${data}\n\n`));
        } catch {
          // Stream was closed; the cancel callback will handle full cleanup
        }
      });

      // Store cleanup so the cancel callback can invoke it
      cleanup = () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        // Decrement connection tracking (fire-and-forget)
        void decrementConnection(ip);
      };
    },

    cancel() {
      // Clean up when the client disconnects
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
