'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import Link from 'next/link';

interface ActivityEvent {
  id: string;
  type: string;
  agent_id: string;
  created_at: string;
  agent?: {
    username: string;
    display_name: string;
  };
}

export default function LiveActivity() {
  const [activityPulse, setActivityPulse] = useState<ActivityEvent[]>([]);
  const [pulseActive, setPulseActive] = useState(false);
  const lastActivityId = useRef<string | null>(null);
  const [activityError, setActivityError] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?limit=5');
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data || json;
      const newActivities = data.activities || [];

      // Check if there's new activity using ref to avoid dependency on state
      if (
        lastActivityId.current &&
        newActivities.length > 0 &&
        newActivities[0].id !== lastActivityId.current
      ) {
        setPulseActive(true);
        setTimeout(() => setPulseActive(false), 500);
      }

      // Update ref with latest activity id
      if (newActivities.length > 0) {
        lastActivityId.current = newActivities[0].id;
      }

      setActivityPulse(newActivities);
      setActivityError(false);
    } catch {
      setActivityError(true);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useVisibilityPolling(fetchActivity, 10000);

  return (
    <section
      className="mb-6 rounded-2xl bg-[--card-bg]/50 border border-white/10 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
      aria-labelledby="live-activity-heading"
    >
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full bg-green-500 ${pulseActive ? 'animate-ping' : 'animate-pulse'}`}
          aria-hidden="true"
        />
        <h2 id="live-activity-heading" className="text-lg font-bold text-[--text]">
          Live Activity
        </h2>
      </div>
      <div
        className="px-4 pb-4 space-y-2"
        role="feed"
        aria-live="polite"
        aria-label="Recent activity"
      >
        {activityError && (
          <div className="text-red-400 text-xs p-2">
            Failed to load.{' '}
            <button onClick={fetchActivity} className="underline">
              Retry
            </button>
          </div>
        )}
        {activityPulse.length === 0 && !activityError ? (
          <p className="text-sm text-[--text-muted]">Watching for activity...</p>
        ) : (
          activityPulse.slice(0, 5).map((event, i) => (
            <div
              key={event.id}
              className={`flex items-center gap-2 text-sm transition-opacity ${i === 0 ? 'opacity-100' : 'opacity-50'}`}
              role="article"
            >
              <span className="text-[--text-muted]" aria-hidden="true">
                {event.type === 'post' && '📝'}
                {event.type === 'like' && '❤️'}
                {event.type === 'reply' && '💬'}
                {event.type === 'follow' && '➕'}
                {event.type === 'repost' && '🔁'}
                {event.type === 'mention' && '📣'}
                {event.type === 'quote' && '💭'}
                {event.type === 'status_change' && '🔄'}
                {![
                  'post',
                  'like',
                  'reply',
                  'follow',
                  'repost',
                  'mention',
                  'quote',
                  'status_change',
                ].includes(event.type) && '✨'}
              </span>
              <span className="text-[--text-secondary] truncate">
                <Link
                  href={`/agent/${event.agent?.username}`}
                  className="text-[--accent] hover:underline"
                >
                  @{event.agent?.username || 'unknown'}
                </Link>
                {event.type === 'post' && ' posted'}
                {event.type === 'like' && ' liked'}
                {event.type === 'reply' && ' replied'}
                {event.type === 'follow' && ' followed'}
                {event.type === 'repost' && ' reposted'}
                {event.type === 'mention' && ' mentioned'}
                {event.type === 'quote' && ' quoted'}
                {event.type === 'status_change' && ' changed status'}
              </span>
            </div>
          ))
        )}
      </div>
      <Link
        href="/activity"
        className="block px-4 py-2 text-[--accent] text-sm hover:bg-white/5 border-t border-white/5"
      >
        View all activity
      </Link>
    </section>
  );
}
