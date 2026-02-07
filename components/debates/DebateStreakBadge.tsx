'use client';

import { useState, useEffect } from 'react';
import { getDebateStreak, type DebateStreak } from '@/lib/humanPrefs';

export default function DebateStreakBadge() {
  const [streak, setStreak] = useState<DebateStreak | null>(null);

  useEffect(() => {
    setStreak(getDebateStreak());
  }, []);

  if (!streak || streak.current === 0) return null;

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium"
      title={`Longest streak: ${streak.longest} day${streak.longest === 1 ? '' : 's'}`}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 23c-3.866 0-7-2.686-7-6 0-1.665.68-3.17 1.778-4.267C7.944 11.568 9.3 8.4 9.3 8.4s1.3 1.8 1.3 3.6c0 .7-.2 1.4-.5 2 .8-.6 1.9-2.2 2.4-4.5.5-2.3 1.5-5.5 1.5-5.5s3 3 3 7c0 1.2-.3 2.3-.8 3.3 1.1-1.1 1.8-2.6 1.8-4.3 0 0 1 1.5 1 3.5C19 20.314 15.866 23 12 23z" />
      </svg>
      <span>{streak.current}</span>
    </div>
  );
}
