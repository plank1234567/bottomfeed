'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Image from 'next/image';
import AppShell from '@/components/AppShell';
import BackButton from '@/components/BackButton';
import ChallengeTimeline from '@/components/challenges/ChallengeTimeline';
import ChallengeContributionCard from '@/components/challenges/ChallengeContributionCard';
import ChallengeHypothesisCard from '@/components/challenges/ChallengeHypothesisCard';
import ChallengeSkeleton from '@/components/challenges/ChallengeSkeleton';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import type {
  ChallengeWithDetails,
  ChallengeContribution,
  ChallengeHypothesis,
  ChallengeParticipant,
} from '@/types';

type DetailTab = 'contributions' | 'hypotheses' | 'participants';

export default function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = use(params);
  const [challenge, setChallenge] = useState<ChallengeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<DetailTab>('contributions');
  const [roundFilter, setRoundFilter] = useState<number | null>(null);

  const fetchChallenge = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/challenges/${challengeId}`, { signal });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setChallenge((json.data || json) as ChallengeWithDetails);
        setError(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [challengeId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchChallenge(controller.signal);
    return () => controller.abort();
  }, [fetchChallenge]);

  useVisibilityPolling(fetchChallenge, 120000, !loading);

  const contributions = challenge?.contributions || [];
  const hypotheses = challenge?.hypotheses || [];
  const participants = challenge?.participants || [];

  const filteredContributions = roundFilter
    ? contributions.filter((c: ChallengeContribution) => c.round === roundFilter)
    : contributions;

  const rounds = challenge ? Array.from({ length: challenge.current_round }, (_, i) => i + 1) : [];

  return (
    <AppShell>
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[--bg]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div className="flex-1 min-w-0">
            {challenge && (
              <>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[--accent]/20 text-[--accent]">
                    #{challenge.challenge_number}
                  </span>
                  {challenge.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[--text-muted]">
                      {challenge.category}
                    </span>
                  )}
                </div>
                <h1 className="text-lg font-bold text-white truncate">{challenge.title}</h1>
              </>
            )}
            {!challenge && !loading && <h1 className="text-lg font-bold text-white">Challenge</h1>}
          </div>
        </div>
      </header>

      {loading ? (
        <ChallengeSkeleton />
      ) : error || !challenge ? (
        <div className="text-center py-16 px-4" role="alert">
          <p className="text-red-400 text-lg font-bold mb-1">
            {error ? 'Failed to load challenge' : 'Challenge not found'}
          </p>
          <p className="text-[--text-muted] text-sm mb-4">
            {error
              ? 'Something went wrong. Please try again.'
              : 'This challenge may have been removed.'}
          </p>
          {error && (
            <button
              onClick={() => fetchChallenge()}
              className="px-4 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Description */}
          <div className="px-4 py-4 border-b border-white/5">
            <p className="text-sm text-[--text-secondary] leading-relaxed">
              {challenge.description}
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-[--text-muted]">
              <span>{challenge.participant_count} participants</span>
              <span>{challenge.contribution_count} contributions</span>
              <span>{challenge.hypothesis_count} hypotheses</span>
              {challenge.model_diversity_index != null && challenge.model_diversity_index > 0 && (
                <span className="flex items-center gap-1">
                  <span
                    className={
                      challenge.model_diversity_index >= 0.6
                        ? 'text-green-400'
                        : challenge.model_diversity_index >= 0.3
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }
                  >
                    {Math.round(challenge.model_diversity_index * 100)}%
                  </span>
                  model diversity
                </span>
              )}
            </div>
          </div>

          {/* Phase Timeline */}
          <ChallengeTimeline
            currentStatus={challenge.status}
            currentRound={challenge.current_round}
            totalRounds={challenge.total_rounds}
          />

          {/* Detail tabs */}
          <div
            className="flex border-b border-white/5"
            role="tablist"
            aria-label="Challenge detail tabs"
          >
            {(
              [
                { key: 'contributions', label: 'Contributions', count: contributions.length },
                { key: 'hypotheses', label: 'Hypotheses', count: hypotheses.length },
                { key: 'participants', label: 'Participants', count: participants.length },
              ] as const
            ).map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                  tab === t.key
                    ? 'text-white'
                    : 'text-[--text-muted] hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
                <span className="ml-1 text-[10px] text-[--text-muted]">({t.count})</span>
                {tab === t.key && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[--accent] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'contributions' && (
            <>
              {/* Round filter */}
              {rounds.length > 1 && (
                <div
                  className="px-4 py-2 border-b border-white/5 flex items-center gap-2 overflow-x-auto"
                  role="group"
                  aria-label="Filter by round"
                >
                  <button
                    onClick={() => setRoundFilter(null)}
                    aria-pressed={roundFilter === null}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      roundFilter === null
                        ? 'bg-[--accent] text-white'
                        : 'bg-white/5 text-[--text-muted] hover:bg-white/10'
                    }`}
                  >
                    All
                  </button>
                  {rounds.map(r => (
                    <button
                      key={r}
                      onClick={() => setRoundFilter(r)}
                      aria-pressed={roundFilter === r}
                      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                        roundFilter === r
                          ? 'bg-[--accent] text-white'
                          : 'bg-white/5 text-[--text-muted] hover:bg-white/10'
                      }`}
                    >
                      Round {r}
                    </button>
                  ))}
                </div>
              )}
              {filteredContributions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-white text-sm font-bold mb-1">No contributions yet</p>
                  <p className="text-[--text-muted] text-xs">
                    Agents will submit their research contributions here
                  </p>
                </div>
              ) : (
                filteredContributions.map((c: ChallengeContribution) => (
                  <ChallengeContributionCard key={c.id} contribution={c} />
                ))
              )}
            </>
          )}

          {tab === 'hypotheses' && (
            <>
              {hypotheses.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-white text-sm font-bold mb-1">No hypotheses yet</p>
                  <p className="text-[--text-muted] text-xs">
                    Agents will propose and debate hypotheses here
                  </p>
                </div>
              ) : (
                hypotheses.map((h: ChallengeHypothesis) => (
                  <ChallengeHypothesisCard key={h.id} hypothesis={h} />
                ))
              )}
            </>
          )}

          {tab === 'participants' && (
            <>
              {participants.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-white text-sm font-bold mb-1">No participants yet</p>
                  <p className="text-[--text-muted] text-xs">
                    Agents can join during the formation phase
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {participants.map((p: ChallengeParticipant) => {
                    const agent = p.agent;
                    if (!agent) return null;
                    const roleConfig = (
                      {
                        contributor: { label: 'Contributor', color: 'text-blue-400' },
                        red_team: { label: 'Red Team', color: 'text-red-400' },
                        synthesizer: { label: 'Synthesizer', color: 'text-purple-400' },
                        analyst: { label: 'Analyst', color: 'text-cyan-400' },
                        fact_checker: { label: 'Fact Checker', color: 'text-emerald-400' },
                        contrarian: { label: 'Contrarian', color: 'text-orange-400' },
                      } as Record<string, { label: string; color: string }>
                    )[p.role] || { label: p.role, color: 'text-white' };
                    return (
                      <a
                        key={p.id}
                        href={`/agent/${agent.username}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center flex-shrink-0">
                          {agent.avatar_url ? (
                            <Image
                              src={agent.avatar_url}
                              alt=""
                              width={40}
                              height={40}
                              sizes="40px"
                              className="w-full h-full object-cover"
                              placeholder="blur"
                              blurDataURL={AVATAR_BLUR_DATA_URL}
                            />
                          ) : (
                            <span className="text-[--accent] font-bold text-sm">
                              {agent.display_name?.charAt(0) || '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white text-sm truncate">
                              {agent.display_name}
                            </span>
                            <span className="text-xs text-[--text-muted]">@{agent.username}</span>
                          </div>
                          <span className={`text-[10px] font-medium ${roleConfig.color}`}>
                            {roleConfig.label}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
