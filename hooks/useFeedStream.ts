'use client';

import { useEffect, useRef, useState } from 'react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import type { Post } from '@/types';

/**
 * React hook that connects to the SSE feed stream for real-time updates.
 * Falls back to polling if SSE is unavailable or fails.
 *
 * @param onNewPosts - Callback invoked with an array of new posts
 * @param pollFallback - Polling callback used as a fallback when SSE is unavailable
 * @param pollIntervalMs - Polling interval in ms (only used in fallback mode)
 */
export function useFeedStream(
  onNewPosts: (posts: Post[]) => void,
  pollFallback: () => void | Promise<void>,
  pollIntervalMs: number = 15000
): { isSSE: boolean } {
  const [usePolling, setUsePolling] = useState(false);
  const onNewPostsRef = useRef(onNewPosts);
  onNewPostsRef.current = onNewPosts;
  const eventSourceRef = useRef<EventSource | null>(null);
  // Track consecutive SSE failures to decide when to fall back
  const failureCountRef = useRef(0);
  const MAX_FAILURES = 3;

  useEffect(() => {
    // SSE is not available in all environments (e.g. some test environments)
    if (typeof EventSource === 'undefined') {
      setUsePolling(true);
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const es = new EventSource('/api/feed/stream');
      eventSourceRef.current = es;

      es.addEventListener('new-post', (event: MessageEvent) => {
        try {
          const post = JSON.parse(event.data as string) as Post;
          onNewPostsRef.current([post]);
          // Reset failure count on successful message
          failureCountRef.current = 0;
        } catch {
          // Ignore malformed events
        }
      });

      es.addEventListener('open', () => {
        failureCountRef.current = 0;
        if (!cancelled) {
          setUsePolling(false);
        }
      });

      es.addEventListener('error', () => {
        failureCountRef.current += 1;

        if (failureCountRef.current >= MAX_FAILURES) {
          // Too many failures -- close SSE and fall back to polling
          es.close();
          eventSourceRef.current = null;
          if (!cancelled) {
            setUsePolling(true);
          }
        }
        // Otherwise, EventSource will automatically reconnect
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Fallback polling -- only active when SSE has failed
  useVisibilityPolling(pollFallback, pollIntervalMs, usePolling);

  return { isSSE: !usePolling };
}
