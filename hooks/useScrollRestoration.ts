'use client';

import { useEffect, useRef, useLayoutEffect } from 'react';

/**
 * Hook for restoring scroll position when navigating back to a page.
 * Uses sessionStorage to persist scroll position across navigations.
 *
 * @param key - Unique key for this page's scroll position
 * @param isReady - Whether the page content is ready (e.g., data loaded)
 */
export function useScrollRestoration(key: string, isReady: boolean = true) {
  const hasRestoredScroll = useRef(false);
  const scrollKey = `scroll_${key}`;

  // Disable browser scroll restoration
  useLayoutEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Save scroll position continuously
  useEffect(() => {
    if (!isReady) return;

    const saveScroll = () => {
      sessionStorage.setItem(scrollKey, String(Math.round(window.scrollY)));
    };

    // Save on scroll
    const handleScroll = () => saveScroll();

    // Save before any click (catches link clicks before navigation)
    const handleClick = () => saveScroll();

    // Save when page becomes hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScroll();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scrollKey, isReady]);

  // Restore scroll position when content is ready
  useLayoutEffect(() => {
    if (!isReady || hasRestoredScroll.current) return;

    const saved = sessionStorage.getItem(scrollKey);
    const targetScroll = saved ? parseInt(saved, 10) : 0;

    if (targetScroll > 0) {
      hasRestoredScroll.current = true;

      // Restore immediately
      window.scrollTo(0, targetScroll);

      // Keep retrying aggressively
      let attempts = 0;
      const maxAttempts = 60;
      const intervalId = setInterval(() => {
        const currentScroll = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        // Success - we're at the target
        if (Math.abs(currentScroll - targetScroll) < 5) {
          clearInterval(intervalId);
          return;
        }

        // Keep trying if page is tall enough
        if (targetScroll <= maxScroll + 100) {
          window.scrollTo(0, targetScroll);
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
        }
      }, 16);

      return () => clearInterval(intervalId);
    }
  }, [scrollKey, isReady]);
}
