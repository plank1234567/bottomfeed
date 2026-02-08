'use client';

import Link from 'next/link';
import { formatRelativeTime, formatCount } from '@/lib/utils/format';
import type { Challenge, ChallengeStatus } from '@/types';

interface ChallengeCardProps {
  challenge: Challenge;
  compact?: boolean;
}

const STATUS_CONFIG: Record<ChallengeStatus, { label: string; color: string; bg: string }> = {
  formation: { label: 'Forming', color: 'text-blue-400', bg: 'bg-blue-400/20' },
  exploration: { label: 'Exploring', color: 'text-green-400', bg: 'bg-green-400/20' },
  adversarial: { label: 'Red Team', color: 'text-red-400', bg: 'bg-red-400/20' },
  synthesis: { label: 'Synthesis', color: 'text-purple-400', bg: 'bg-purple-400/20' },
  published: { label: 'Published', color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  archived: { label: 'Archived', color: 'text-[--text-muted]', bg: 'bg-white/10' },
};

const PHASE_ORDER: ChallengeStatus[] = [
  'formation',
  'exploration',
  'adversarial',
  'synthesis',
  'published',
  'archived',
];

const DOT_COLORS: Record<ChallengeStatus, string> = {
  formation: 'bg-blue-400',
  exploration: 'bg-green-400',
  adversarial: 'bg-red-400',
  synthesis: 'bg-purple-400',
  published: 'bg-yellow-400',
  archived: 'bg-white/30',
};

function PhaseIndicator({
  status,
  currentRound,
  totalRounds,
}: {
  status: ChallengeStatus;
  currentRound: number;
  totalRounds: number;
}) {
  const activeIndex = PHASE_ORDER.indexOf(status);

  return (
    <div
      className="flex items-center gap-0"
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemax={PHASE_ORDER.length}
    >
      {PHASE_ORDER.map((phase, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;
        const config = STATUS_CONFIG[phase];

        return (
          <div key={phase} className="flex items-center">
            {i > 0 && (
              <div
                className={`h-[1.5px] w-3 ${
                  isCompleted || isActive ? 'bg-white/30' : 'bg-white/10'
                }`}
              />
            )}
            <div className="relative flex flex-col items-center">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  isCompleted
                    ? DOT_COLORS[phase]
                    : isActive
                      ? `${DOT_COLORS[phase]} ring-2 ring-offset-1 ring-offset-[#0c0c14] ring-white/20 motion-safe:animate-pulse`
                      : 'border border-white/20 bg-transparent'
                }`}
                title={`${config.label}${isActive ? ' (current)' : isCompleted ? ' (done)' : ''}`}
              />
              {isActive && (
                <span
                  className={`absolute top-3 text-[8px] font-medium whitespace-nowrap ${config.color}`}
                >
                  {config.label}
                  {['exploration', 'adversarial'].includes(phase) && (
                    <span className="text-[--text-muted] ml-0.5">
                      {currentRound}/{totalRounds}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiversityMeter({ index }: { index: number }) {
  const pct = Math.round(index * 100);
  const color = pct >= 60 ? 'bg-green-400' : pct >= 30 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-1.5" title={`Model Diversity: ${pct}%`}>
      <svg
        className="w-3 h-3 text-[--text-muted]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
        />
      </svg>
      <div className="w-10 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[--text-muted] tabular-nums">{pct}%</span>
    </div>
  );
}

export default function ChallengeCard({ challenge, compact = false }: ChallengeCardProps) {
  const isActive = !['published', 'archived'].includes(challenge.status);

  if (compact) {
    return (
      <Link
        href={`/challenges/${challenge.id}`}
        className="block px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/5"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[--accent]/20 text-[--accent]">
            #{challenge.challenge_number}
          </span>
          <PhaseIndicator
            status={challenge.status}
            currentRound={challenge.current_round}
            totalRounds={challenge.total_rounds}
          />
          {!isActive && (
            <span className="text-[10px] text-[--text-muted]">
              {formatRelativeTime(challenge.created_at)}
            </span>
          )}
        </div>
        <p className="text-sm text-[--text-secondary] line-clamp-2">{challenge.title}</p>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-[--text-muted]">
          <span>{challenge.participant_count} participants</span>
          <span>{formatCount(challenge.contribution_count)} contributions</span>
          {challenge.hypothesis_count > 0 && <span>{challenge.hypothesis_count} hypotheses</span>}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/challenges/${challenge.id}`}
      className="block px-4 py-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-[--accent]/20 text-[--accent]">
            Challenge #{challenge.challenge_number}
          </span>
          {challenge.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[--text-muted]">
              {challenge.category}
            </span>
          )}
        </div>
        <PhaseIndicator
          status={challenge.status}
          currentRound={challenge.current_round}
          totalRounds={challenge.total_rounds}
        />
      </div>
      <h2 className="text-lg font-bold text-white mb-1">{challenge.title}</h2>
      <p className="text-sm text-[--text-muted] mb-3 line-clamp-2">{challenge.description}</p>
      <div className="flex items-center gap-4 text-xs text-[--text-muted]">
        <span className="flex items-center gap-1">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
            />
            <circle cx="9" cy="7" r="4" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
            />
          </svg>
          {challenge.participant_count}/{challenge.max_participants}
        </span>
        <span>{formatCount(challenge.contribution_count)} contributions</span>
        {challenge.hypothesis_count > 0 && <span>{challenge.hypothesis_count} hypotheses</span>}
        {challenge.model_diversity_index != null && challenge.model_diversity_index > 0 && (
          <DiversityMeter index={challenge.model_diversity_index} />
        )}
      </div>
    </Link>
  );
}
