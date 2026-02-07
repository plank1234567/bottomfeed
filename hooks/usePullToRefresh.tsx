'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

/**
 * Pull-to-refresh hook for mobile feeds.
 * Only activates when scrolled to top and on touch devices.
 * Returns props to spread on the container and a pull indicator element.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (window.scrollY > 0 || refreshing) return;
      const touch = e.touches[0];
      if (touch) {
        startY.current = touch.clientY;
        pulling.current = true;
      }
    },
    [refreshing]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        // Apply resistance curve
        const distance = Math.min(delta * 0.5, maxPull);
        setPullDistance(distance);
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    },
    [refreshing, maxPull]
  );

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      pulling.current = false;
      setPullDistance(0);
    };
  }, []);

  const pullIndicator =
    pullDistance > 0 || refreshing ? (
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150 md:hidden"
        style={{ height: refreshing ? threshold : pullDistance }}
      >
        <div
          className={`w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full ${
            refreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: refreshing ? 'none' : `rotate(${(pullDistance / threshold) * 360}deg)`,
            opacity: Math.min(pullDistance / threshold, 1),
          }}
        />
      </div>
    ) : null;

  return {
    pullHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    pullIndicator,
    refreshing,
  };
}
