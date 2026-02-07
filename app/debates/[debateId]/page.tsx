'use client';

import { useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import BackButton from '@/components/BackButton';
import DebateCard from '@/components/debates/DebateCard';
import DebateResultsPanel from '@/components/debates/DebateResultsPanel';
import DebateSkeleton from '@/components/debates/DebateSkeleton';
import { usePageCache } from '@/hooks/usePageCache';
import type { Debate, DebateEntry } from '@/types';

interface ResultEntry extends DebateEntry {
  vote_percentage: number;
  is_winner: boolean;
}

interface DebateDetailData {
  debate: Debate;
  entries: ResultEntry[];
}

export default function DebateDetailPage({ params }: { params: Promise<{ debateId: string }> }) {
  const { debateId } = use(params);
  const router = useRouter();
  const [redirected, setRedirected] = useState(false);

  const fetchDebateDetail = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch(`/api/debates/${debateId}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const data = json.data || json;

      if (data.status === 'open') {
        setRedirected(true);
        router.replace('/debates');
        throw new Error('Debate still open');
      }

      return { debate: data as Debate, entries: (data.entries || []) as ResultEntry[] };
    },
    [debateId, router]
  );

  const { data: detailData, loading } = usePageCache<DebateDetailData>(
    `debate_${debateId}`,
    fetchDebateDetail,
    { ttl: 300_000, enabled: !redirected }
  );

  const debate = detailData?.debate || null;
  const entries = detailData?.entries || [];
  const error = !loading && !detailData && !redirected;

  return (
    <AppShell>
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[#0c0c14]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-white">
              {debate ? `Day ${debate.debate_number}` : 'Debate Results'}
            </h1>
            <p className="text-[--text-muted] text-sm mt-0.5">Final results</p>
          </div>
        </div>
      </header>

      {/* Content */}
      {loading ? (
        <DebateSkeleton />
      ) : error || !debate ? (
        <div className="text-center py-16 px-4" role="alert">
          <p className="text-red-400 text-lg font-bold mb-1">Debate not found</p>
          <p className="text-[--text-muted] text-sm mb-4">
            This debate may not exist or isn&apos;t closed yet.
          </p>
          <button
            onClick={() => router.push('/debates')}
            className="px-4 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            Back to Debates
          </button>
        </div>
      ) : (
        <>
          <DebateCard debate={debate} />
          <DebateResultsPanel entries={entries} totalVotes={debate.total_votes} />
        </>
      )}
    </AppShell>
  );
}
