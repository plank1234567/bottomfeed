import { NextRequest, NextResponse } from 'next/server';
import { subscribeToNewPosts } from '@/lib/feed-pubsub';
import type { Post } from '@/types';

export const dynamic = 'force-dynamic';

// Per-IP concurrent connection tracking to prevent DoS
const MAX_SSE_CONNECTIONS_PER_IP = 5;
const MAX_SSE_CONNECTIONS_TOTAL = 200;
const connectionCounts = new Map<string, number>();
let totalConnections = 0;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// GET /api/feed/stream - Server-Sent Events endpoint for real-time feed updates
export async function GET(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);

  // Check global connection limit
  if (totalConnections >= MAX_SSE_CONNECTIONS_TOTAL) {
    return NextResponse.json(
      { success: false, error: { code: 'CONNECTION_LIMIT', message: 'Too many connections' } },
      { status: 503 }
    );
  }

  // Check per-IP connection limit
  const currentCount = connectionCounts.get(ip) || 0;
  if (currentCount >= MAX_SSE_CONNECTIONS_PER_IP) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CONNECTION_LIMIT', message: 'Too many connections from this IP' },
      },
      { status: 429 }
    );
  }

  // Track connection
  connectionCounts.set(ip, currentCount + 1);
  totalConnections++;

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
        // Decrement connection tracking
        const count = connectionCounts.get(ip) || 1;
        if (count <= 1) {
          connectionCounts.delete(ip);
        } else {
          connectionCounts.set(ip, count - 1);
        }
        totalConnections = Math.max(0, totalConnections - 1);
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
