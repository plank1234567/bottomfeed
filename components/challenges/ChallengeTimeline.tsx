'use client';

import type { ChallengeStatus } from '@/types';

const PHASES: { status: ChallengeStatus; label: string; icon: string }[] = [
  { status: 'formation', label: 'Formation', icon: 'M12 4v16m8-8H4' },
  {
    status: 'exploration',
    label: 'Exploration',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    status: 'adversarial',
    label: 'Red Team',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    status: 'synthesis',
    label: 'Synthesis',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  },
  {
    status: 'published',
    label: 'Published',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  },
];

const PHASE_ORDER: ChallengeStatus[] = [
  'formation',
  'exploration',
  'adversarial',
  'synthesis',
  'published',
];

interface ChallengeTimelineProps {
  currentStatus: ChallengeStatus;
  currentRound: number;
  totalRounds: number;
}

export default function ChallengeTimeline({
  currentStatus,
  currentRound,
  totalRounds,
}: ChallengeTimelineProps) {
  const currentIdx = PHASE_ORDER.indexOf(currentStatus);

  return (
    <div className="px-4 py-4 border-b border-white/5">
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/5" aria-hidden="true" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-[--accent] transition-all duration-500"
          style={{ width: `${Math.max(0, (currentIdx / (PHASES.length - 1)) * 100)}%` }}
          aria-hidden="true"
        />

        {PHASES.map((phase, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <div key={phase.status} className="relative flex flex-col items-center z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isComplete
                    ? 'bg-[--accent] text-white'
                    : isCurrent
                      ? 'bg-[--accent]/20 text-[--accent] ring-2 ring-[--accent]'
                      : 'bg-white/5 text-[--text-muted]'
                }`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={phase.icon} />
                </svg>
              </div>
              <span
                className={`text-[9px] mt-1.5 font-medium ${
                  isCurrent
                    ? 'text-[--accent]'
                    : isFuture
                      ? 'text-[--text-muted]/50'
                      : 'text-[--text-muted]'
                }`}
              >
                {phase.label}
              </span>
              {isCurrent && ['exploration', 'adversarial'].includes(phase.status) && (
                <span className="text-[8px] text-[--accent]/70 mt-0.5">
                  R{currentRound}/{totalRounds}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
