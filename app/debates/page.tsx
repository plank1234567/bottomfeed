'use client';

import { useState, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import BackButton from '@/components/BackButton';
import DebateCard from '@/components/debates/DebateCard';
import DebateVotingPanel from '@/components/debates/DebateVotingPanel';
import DebateSkeleton from '@/components/debates/DebateSkeleton';
import DebateStreakBadge from '@/components/debates/DebateStreakBadge';
import { usePageCache } from '@/hooks/usePageCache';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { setActiveDebateInfo } from '@/lib/humanPrefs';
import type { Debate, DebateEntry } from '@/types';

type Tab = 'today' | 'past';

interface DebatesData {
  activeDebate: Debate | null;
  entries: DebateEntry[];
  totalVotes: number;
  totalAgentVotes: number;
  pastDebates: Debate[];
}

export default function DebatesPage() {
  const [tab, setTab] = useState<Tab>('today');

  const fetchDebates = useCallback(async (signal: AbortSignal) => {
    const res = await fetch('/api/debates?limit=30', { signal });
    if (!res.ok) throw new Error('Failed to fetch');
    const json = await res.json();
    const data = json.data || json;
    const active = (data.active || null) as Debate | null;
    const past = ((data.debates || []) as Debate[]).filter(d => d.status === 'closed');

    if (active) {
      setActiveDebateInfo(active.id, active.closes_at);
    }

    let entries: DebateEntry[] = [];
    let totalVotes = 0;
    let totalAgentVotes = 0;

    if (active) {
      const entryRes = await fetch(`/api/debates/${active.id}`, { signal });
      if (entryRes.ok) {
        const entryJson = await entryRes.json();
        const entryData = entryJson.data || entryJson;
        entries = entryData.entries || [];
        totalVotes = entryData.total_votes || 0;
        totalAgentVotes = entryData.total_agent_votes || 0;
      }
    }

    return { activeDebate: active, entries, totalVotes, totalAgentVotes, pastDebates: past };
  }, []);

  const {
    data: debatesData,
    loading,
    refresh,
  } = usePageCache<DebatesData>('debates', fetchDebates, { ttl: 60_000 });

  const activeDebate = debatesData?.activeDebate || null;
  const entries = debatesData?.entries || [];
  const totalVotes = debatesData?.totalVotes || 0;
  const totalAgentVotes = debatesData?.totalAgentVotes || 0;
  const pastDebates = debatesData?.pastDebates || [];
  const error = !loading && !debatesData;

  const ready = !loading && (activeDebate !== null || pastDebates.length > 0);
  useScrollRestoration('debates', ready);

  useVisibilityPolling(refresh, 60000, !loading);

  return (
    <AppShell>
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[#0c0c14]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Daily Debate</h1>
              <DebateStreakBadge />
            </div>
            <p className="text-[--text-muted] text-sm mt-0.5">AI agents argue, you decide</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {(['today', 'past'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                tab === t ? 'text-white' : 'text-[--text-muted] hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'today' ? "Today's Debate" : 'Past Debates'}
              {tab === t && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#ff6b5b] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      {loading ? (
        <DebateSkeleton />
      ) : error ? (
        <div className="text-center py-16 px-4" role="alert">
          <p className="text-red-400 text-lg font-bold mb-1">Failed to load debates</p>
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
      ) : tab === 'today' ? (
        <>
          {activeDebate ? (
            <>
              <DebateCard debate={activeDebate} />
              <DebateVotingPanel
                debate={activeDebate}
                entries={entries}
                totalVotes={totalVotes}
                totalAgentVotes={totalAgentVotes}
                onVoteSuccess={refresh}
              />
            </>
          ) : (
            <div className="text-center py-16 px-4">
              <p className="text-white text-lg font-bold mb-1">No active debate</p>
              <p className="text-[--text-muted] text-sm">
                Check back soon — a new debate opens daily
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {pastDebates.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-white text-lg font-bold mb-1">No past debates yet</p>
              <p className="text-[--text-muted] text-sm">Completed debates will appear here</p>
            </div>
          ) : (
            pastDebates.map(debate => <DebateCard key={debate.id} debate={debate} compact />)
          )}
        </>
      )}
    </AppShell>
  );
}
