'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatRelativeTime, formatCount } from '@/lib/utils/format';
import { DEBATE_DURATION_HOURS } from '@/lib/constants';
import type { Debate } from '@/types';

interface DebateCardProps {
  debate: Debate;
  compact?: boolean;
}

function getTimeRemaining(closesAt: string): { hours: number; mins: number; total: number } {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return { hours: 0, mins: 0, total: 0 };
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return { hours, mins, total: diff };
}

function formatTimeStr(hours: number, mins: number): string {
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

const RING_SIZE = 44;
const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CountdownRing({ closesAt }: { closesAt: string }) {
  const [time, setTime] = useState(() => getTimeRemaining(closesAt));

  useEffect(() => {
    setTime(getTimeRemaining(closesAt));
    const interval = setInterval(() => {
      setTime(getTimeRemaining(closesAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [closesAt]);

  const totalDuration = DEBATE_DURATION_HOURS * 3600000;
  const progress = Math.max(0, Math.min(1, time.total / totalDuration));
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  const isUrgent = time.total > 0 && time.total < 3600000; // under 1 hour

  if (time.total <= 0) {
    return <span className="text-xs text-[--text-muted]">Closed</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`relative ${isUrgent ? 'animate-pulse' : ''}`}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={3}
          />
          {/* Progress ring */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={isUrgent ? '#f59e0b' : '#4ade80'}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={isUrgent ? { filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.4))' } : undefined}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-[10px] font-bold tabular-nums ${isUrgent ? 'text-yellow-400' : 'text-green-400'}`}
          >
            {time.hours > 0 ? `${time.hours}h` : `${time.mins}m`}
          </span>
        </div>
      </div>
      <span className={`text-xs ${isUrgent ? 'text-yellow-400' : 'text-green-400'}`}>
        {formatTimeStr(time.hours, time.mins)} remaining
      </span>
    </div>
  );
}

function CompactCountdown({ closesAt }: { closesAt: string }) {
  const [time, setTime] = useState(() => getTimeRemaining(closesAt));

  useEffect(() => {
    setTime(getTimeRemaining(closesAt));
    const interval = setInterval(() => {
      setTime(getTimeRemaining(closesAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [closesAt]);

  if (time.total <= 0) return null;

  const isUrgent = time.total < 3600000;

  return (
    <span className={`text-[10px] ${isUrgent ? 'text-yellow-400' : 'text-green-400'}`}>
      {formatTimeStr(time.hours, time.mins)} left
    </span>
  );
}

export default function DebateCard({ debate, compact = false }: DebateCardProps) {
  const isOpen = debate.status === 'open';
  const isClosed = debate.status === 'closed';

  if (compact) {
    return (
      <Link
        href={isClosed ? `/debates/${debate.id}` : '/debates'}
        className="block px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/5"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[--accent]/20 text-[--accent]">
            Day {debate.debate_number}
          </span>
          {isClosed && (
            <span className="text-[10px] text-[--text-muted]">
              {formatRelativeTime(debate.closes_at)}
            </span>
          )}
          {isOpen && <CompactCountdown closesAt={debate.closes_at} />}
        </div>
        <p className="text-sm text-[--text-secondary] line-clamp-2">{debate.topic}</p>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-[--text-muted]">
          <span>
            {debate.entry_count} argument{debate.entry_count === 1 ? '' : 's'}
          </span>
          {isClosed && (
            <span>
              {formatCount(debate.total_votes)} vote{debate.total_votes === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="px-4 py-6 border-b border-white/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[--accent]/20 text-[--accent]">
          Day {debate.debate_number}
        </span>
        {isOpen && <CountdownRing closesAt={debate.closes_at} />}
        {isClosed && <span className="text-xs text-[--text-muted]">Closed</span>}
      </div>
      <h2 className="text-lg font-bold text-white mb-1">{debate.topic}</h2>
      {debate.description && (
        <p className="text-sm text-[--text-muted] mb-3">{debate.description}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-[--text-muted]">
        <span>
          {debate.entry_count} argument{debate.entry_count === 1 ? '' : 's'}
        </span>
        {isClosed && (
          <span>
            {formatCount(debate.total_votes)} vote{debate.total_votes === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
}
