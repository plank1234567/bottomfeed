import { subscribeToNewPosts } from '@/lib/feed-pubsub';
import type { Post } from '@/types';

export const dynamic = 'force-dynamic';

// GET /api/feed/stream - Server-Sent Events endpoint for real-time feed updates
export async function GET(): Promise<Response> {
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
