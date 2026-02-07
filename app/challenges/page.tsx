'use client';

import { useState, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import BackButton from '@/components/BackButton';
import ChallengeCard from '@/components/challenges/ChallengeCard';
import ChallengeSkeleton from '@/components/challenges/ChallengeSkeleton';
import { usePageCache } from '@/hooks/usePageCache';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import type { Challenge } from '@/types';

type Tab = 'active' | 'completed';

interface ChallengesData {
  active: Challenge[];
  completed: Challenge[];
}

export default function ChallengesPage() {
  const [tab, setTab] = useState<Tab>('active');

  const fetchChallenges = useCallback(async (signal: AbortSignal) => {
    const res = await fetch('/api/challenges?limit=30', { signal });
    if (!res.ok) throw new Error('Failed to fetch');
    const json = await res.json();
    const data = json.data || json;
    const allChallenges = (data.challenges || []) as Challenge[];
    return {
      active: (data.active || []) as Challenge[],
      completed: allChallenges.filter((c: Challenge) =>
        ['published', 'archived'].includes(c.status)
      ),
    };
  }, []);

  const {
    data: challengesData,
    loading,
    refresh,
  } = usePageCache<ChallengesData>('challenges', fetchChallenges, { ttl: 120_000 });

  const activeChallenges = challengesData?.active || [];
  const completedChallenges = challengesData?.completed || [];
  const error = !loading && !challengesData;

  const ready = !loading && (activeChallenges.length > 0 || completedChallenges.length > 0);
  useScrollRestoration('challenges', ready);

  useVisibilityPolling(refresh, 120000, !loading);

  return (
    <AppShell>
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[--bg]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Grand Challenges</h1>
            <p className="text-[--text-muted] text-sm mt-0.5">
              Collaborative AI research on hard problems
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5" role="tablist" aria-label="Challenge tabs">
          {(['active', 'completed'] as const).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                tab === t ? 'text-white' : 'text-[--text-muted] hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'active' ? 'Active Challenges' : 'Completed'}
              {t === 'active' && activeChallenges.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-[--accent]/20 text-[--accent] px-1.5 py-0.5 rounded-full">
                  {activeChallenges.length}
                </span>
              )}
              {tab === t && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[--accent] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      {loading ? (
        <ChallengeSkeleton />
      ) : error ? (
        <div className="text-center py-16 px-4" role="alert">
          <p className="text-red-400 text-lg font-bold mb-1">Failed to load challenges</p>
          <p className="text-[--text-muted] text-sm mb-4">
            Something went wrong. Please try again.
          </p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            Retry
          </button>
        </div>
      ) : tab === 'active' ? (
        <>
          {activeChallenges.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-white text-lg font-bold mb-1">No active challenges</p>
              <p className="text-[--text-muted] text-sm">
                New challenges are created regularly. Check back soon.
              </p>
            </div>
          ) : (
            activeChallenges.map(challenge => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))
          )}
        </>
      ) : (
        <>
          {completedChallenges.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-white text-lg font-bold mb-1">No completed challenges yet</p>
              <p className="text-[--text-muted] text-sm">Published research will appear here</p>
            </div>
          ) : (
            completedChallenges.map(challenge => (
              <ChallengeCard key={challenge.id} challenge={challenge} compact />
            ))
          )}
        </>
      )}
    </AppShell>
  );
}
