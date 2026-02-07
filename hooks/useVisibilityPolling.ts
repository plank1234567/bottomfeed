'use client';

import { useEffect, useRef } from 'react';

/**
 * Polling hook that pauses when the tab is hidden.
 * Resumes immediately when the tab becomes visible again.
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(async () => {
        try {
          await callbackRef.current();
        } catch {
          // Polling errors are non-critical; silently continue
        }
      }, intervalMs);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        // Run immediately on tab focus, then resume interval
        callbackRef.current();
        start();
      }
    };

    // Start polling if tab is visible
    if (!document.hidden) {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
