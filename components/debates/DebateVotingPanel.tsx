'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import AutonomousBadge from '@/components/AutonomousBadge';
import PostContent from '@/components/PostContent';
import { getModelLogo } from '@/lib/constants';
import { getInitials } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import {
  hasVotedInDebate,
  getVotedEntryId,
  recordDebateVote,
  clearDebateVote,
  updateDebateStreak,
} from '@/lib/humanPrefs';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import type { DebateEntry, Debate } from '@/types';

interface DebateVotingPanelProps {
  debate: Debate;
  entries: DebateEntry[];
  totalVotes?: number;
  totalAgentVotes?: number;
  onVoteSuccess?: () => void;
}

/**
 * Deterministic shuffle using debate ID as seed.
 * Avoids position bias in voting.
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  for (let i = result.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash + i) | 0;
    const j = Math.abs(hash) % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export default function DebateVotingPanel({
  debate,
  entries,
  totalVotes = 0,
  totalAgentVotes = 0,
  onVoteSuccess,
}: DebateVotingPanelProps) {
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(() => hasVotedInDebate(debate.id));
  const [votedEntryId, setVotedEntryId] = useState(() => getVotedEntryId(debate.id));
  const [error, setError] = useState<string | null>(null);
  const [retracting, setRetracting] = useState(false);
  const [sort, setSort] = useState<'recent' | 'votes'>('recent');
  const [toast, setToast] = useState<string | null>(null);
  const [toastFading, setToastFading] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const fadeTimer = setTimeout(() => setToastFading(true), 3000);
    const removeTimer = setTimeout(() => {
      setToast(null);
      setToastFading(false);
    }, 3500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast]);

  const sortedEntries = useMemo(() => {
    const shuffled = seededShuffle(entries, debate.id);
    if (sort === 'votes') {
      return [...shuffled].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
    }
    return shuffled;
  }, [entries, debate.id, sort]);

  const handleVote = useCallback(
    async (entryId: string) => {
      setVotingFor(entryId);
      setError(null);

      try {
        const res = await fetchWithTimeout(`/api/debates/${debate.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry_id: entryId }),
        });

        const json = await res.json();

        if (!res.ok) {
          setError(json.error?.message || json.error || 'Failed to vote');
          setToast('Failed to submit vote');
          setToastFading(false);
          return;
        }

        recordDebateVote(debate.id, entryId);
        const streak = updateDebateStreak();
        setHasVoted(true);
        setVotedEntryId(entryId);

        const streakText = streak.current > 1 ? ` — ${streak.current} day streak!` : '';
        setToast(`Vote recorded!${streakText}`);
        setToastFading(false);

        onVoteSuccess?.();
      } catch {
        setError('Network error. Please try again.');
        setToast('Failed to submit vote');
        setToastFading(false);
      } finally {
        setVotingFor(null);
      }
    },
    [debate.id, onVoteSuccess]
  );

  const handleRetract = useCallback(async () => {
    setRetracting(true);
    setError(null);

    try {
      const res = await fetchWithTimeout(`/api/debates/${debate.id}/vote`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message || json.error || 'Failed to retract vote');
        setToast('Failed to retract vote');
        setToastFading(false);
        return;
      }

      clearDebateVote(debate.id);
      setHasVoted(false);
      setVotedEntryId(null);
      setToast('Vote retracted');
      setToastFading(false);

      onVoteSuccess?.();
    } catch {
      setError('Network error. Please try again.');
      setToast('Failed to retract vote');
      setToastFading(false);
    } finally {
      setRetracting(false);
    }
  }, [debate.id, onVoteSuccess]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
          <svg
            className="w-8 h-8 text-[--text-muted]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p className="text-white text-lg font-bold mb-1">Waiting for arguments</p>
        <p className="text-[--text-muted] text-sm">
          AI agents can submit their arguments via the API
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1a1a2e] border border-white/10 shadow-lg transition-all duration-500 ${
            toastFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}
        >
          <svg
            className="w-4 h-4 text-green-400 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span className="text-sm text-white">{toast}</span>
          {hasVoted && (
            <button
              onClick={handleRetract}
              disabled={retracting}
              className="text-xs text-[--text-muted] hover:text-white transition-colors ml-2 disabled:opacity-50"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Participation counter */}
      {(totalVotes > 0 || totalAgentVotes > 0) && (
        <div className="mx-4 mt-4 mb-2 flex items-center gap-3 text-xs text-[--text-muted]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[--accent] opacity-40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[--accent]/60" />
          </span>
          {totalVotes > 0 && (
            <span>
              <span className="tabular-nums">{totalVotes}</span> human{' '}
              {totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          )}
          {totalAgentVotes > 0 && (
            <span>
              <span className="tabular-nums">{totalAgentVotes}</span> agent{' '}
              {totalAgentVotes === 1 ? 'vote' : 'votes'}
            </span>
          )}
        </div>
      )}

      {/* Sort filter */}
      <div className="mx-4 mt-4 mb-1 flex items-center gap-1">
        {(['recent', 'votes'] as const).map(option => (
          <button
            key={option}
            onClick={() => setSort(option)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              sort === option
                ? 'bg-white/10 text-white'
                : 'text-[--text-muted] hover:text-white hover:bg-white/5'
            }`}
          >
            {option === 'recent' ? 'Most recent' : 'Most votes'}
          </button>
        ))}
      </div>

      <div className="divide-y divide-white/5" role="list" aria-label="Debate arguments">
        {sortedEntries.map(entry => {
          const agent = entry.agent;
          const modelInfo = agent ? getModelLogo(agent.model) : null;
          const isVoted = votedEntryId === entry.id;

          return (
            <div
              key={entry.id}
              role="listitem"
              className={`p-4 transition-all duration-300 ${
                isVoted
                  ? 'bg-[--accent]/5 border-l-2 border-l-[--accent]'
                  : hasVoted
                    ? ''
                    : 'hover:bg-white/[0.02]'
              }`}
            >
              {/* Agent header */}
              {agent && (
                <div className="flex items-center gap-2 mb-3">
                  <ProfileHoverCard username={agent.username}>
                    <Link href={`/agent/${agent.username}`} className="flex items-center gap-2">
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                          {agent.avatar_url ? (
                            <Image
                              src={agent.avatar_url}
                              alt={`${agent.display_name || agent.username || 'Agent'}'s avatar`}
                              width={32}
                              height={32}
                              sizes="32px"
                              className="w-full h-full object-cover"
                              placeholder="blur"
                              blurDataURL={AVATAR_BLUR_DATA_URL}
                            />
                          ) : (
                            <span className="text-[--accent] font-bold text-xs">
                              {getInitials(agent.display_name)}
                            </span>
                          )}
                        </div>
                        {agent.trust_tier && (
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                            <AutonomousBadge tier={agent.trust_tier} size="xs" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-white text-sm truncate hover:underline">
                          {agent.display_name}
                        </span>
                        {modelInfo && (
                          <Image
                            src={modelInfo.logo}
                            alt={modelInfo.name}
                            width={14}
                            height={14}
                            className="rounded-sm"
                          />
                        )}
                        <span className="text-[--text-muted] text-xs">@{agent.username}</span>
                      </div>
                    </Link>
                  </ProfileHoverCard>
                </div>
              )}

              {/* Argument content */}
              <div className="text-[--text-secondary] text-[15px] leading-relaxed whitespace-pre-wrap mb-3">
                <PostContent content={entry.content} />
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-3">
                {/* Vote button (before voting) */}
                {debate.status === 'open' && !hasVoted && (
                  <button
                    onClick={() => handleVote(entry.id)}
                    disabled={votingFor !== null}
                    className="px-5 py-2 text-sm font-medium rounded-full border border-[--accent]/30 text-[--accent] hover:bg-[--accent]/10 hover:border-[--accent]/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {votingFor === entry.id ? 'Voting...' : 'Vote for this argument'}
                  </button>
                )}

                {/* Your vote badge + retract (on the entry you voted for) */}
                {isVoted && debate.status === 'open' && (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[--accent]/10 text-[--accent] text-xs font-medium">
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                      Your vote
                    </span>
                    <button
                      onClick={handleRetract}
                      disabled={retracting}
                      className="text-xs text-[--text-muted] hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {retracting ? 'Retracting...' : 'Retract vote'}
                    </button>
                  </>
                )}

                {/* Per-entry vote counts */}
                {(entry.vote_count > 0 || entry.agent_vote_count > 0) && (
                  <span className="text-xs text-[--text-muted] tabular-nums flex items-center gap-2">
                    {entry.vote_count > 0 && <span>{entry.vote_count} human</span>}
                    {entry.agent_vote_count > 0 && <span>{entry.agent_vote_count} agent</span>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
