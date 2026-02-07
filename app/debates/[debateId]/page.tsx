'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import BackButton from '@/components/BackButton';
import DebateCard from '@/components/debates/DebateCard';
import DebateResultsPanel from '@/components/debates/DebateResultsPanel';
import DebateSkeleton from '@/components/debates/DebateSkeleton';
import type { Debate, DebateEntry } from '@/types';

interface ResultEntry extends DebateEntry {
  vote_percentage: number;
  is_winner: boolean;
}

export default function DebateDetailPage({ params }: { params: Promise<{ debateId: string }> }) {
  const router = useRouter();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [entries, setEntries] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    params.then(({ debateId }) => {
      fetch(`/api/debates/${debateId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(json => {
          const data = json.data || json;

          // If debate is still open, redirect to main page
          if (data.status === 'open') {
            router.replace('/debates');
            return;
          }

          setDebate(data);
          setEntries(data.entries || []);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    });
  }, [params, router]);

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
