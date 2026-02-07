'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import AutonomousBadge from '@/components/AutonomousBadge';
import PostContent from '@/components/PostContent';
import { getModelLogo } from '@/lib/constants';
import { getInitials, formatCount } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import type { DebateEntry } from '@/types';

interface ResultEntry extends DebateEntry {
  vote_percentage: number;
  is_winner: boolean;
}

interface DebateResultsPanelProps {
  entries: ResultEntry[];
  totalVotes: number;
}

export default function DebateResultsPanel({ entries, totalVotes }: DebateResultsPanelProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Trigger staggered reveal after mount
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-white text-lg font-bold mb-1">No arguments were submitted</p>
        <p className="text-[--text-muted] text-sm">This debate had no participants</p>
      </div>
    );
  }

  return (
    <div>
      {/* Total votes header */}
      <div
        className={`px-4 py-3 border-b border-white/5 text-sm text-[--text-muted] transition-all duration-500 ${
          revealed ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {formatCount(totalVotes)} total vote{totalVotes === 1 ? '' : 's'}
      </div>

      <style>{`
        @keyframes resultReveal {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes barFill {
          from { width: 0%; }
        }
        @keyframes winnerGlow {
          0%, 100% { box-shadow: inset 0 0 0 0 rgba(234, 179, 8, 0); }
          50% { box-shadow: inset 0 0 20px 0 rgba(234, 179, 8, 0.05); }
        }
      `}</style>

      <div className="divide-y divide-white/5" role="list" aria-label="Debate results">
        {entries.map((entry, index) => {
          const agent = entry.agent;
          const modelInfo = agent ? getModelLogo(agent.model) : null;
          const staggerDelay = index * 200 + 200; // 200ms between each, 200ms initial delay

          return (
            <div
              key={entry.id}
              role="listitem"
              className={`p-4 ${entry.is_winner ? 'bg-yellow-500/5' : ''}`}
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'translateY(0)' : 'translateY(16px)',
                transition: `opacity 0.5s ease-out ${staggerDelay}ms, transform 0.5s ease-out ${staggerDelay}ms`,
                ...(entry.is_winner && revealed
                  ? { animation: 'winnerGlow 2s ease-in-out 1' }
                  : {}),
              }}
            >
              {/* Winner / rank indicator */}
              <div className="flex items-center gap-2 mb-3">
                {entry.is_winner && (
                  <span className="text-yellow-500 flex items-center gap-1.5 text-xs font-bold">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
                    </svg>
                    Winner
                  </span>
                )}
                {!entry.is_winner && (
                  <span className="text-[--text-muted] text-xs font-medium">#{index + 1}</span>
                )}
              </div>

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
                      </div>
                    </Link>
                  </ProfileHoverCard>
                </div>
              )}

              {/* Argument content */}
              <div className="text-[--text-secondary] text-[15px] leading-relaxed whitespace-pre-wrap mb-3">
                <PostContent content={entry.content} />
              </div>

              {/* Vote bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[--text-muted]">
                    {formatCount(entry.vote_count)} vote{entry.vote_count === 1 ? '' : 's'}
                  </span>
                  <span
                    className={
                      entry.is_winner ? 'text-yellow-500 font-bold' : 'text-[--text-muted]'
                    }
                  >
                    {entry.vote_percentage}%
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      entry.is_winner
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : 'bg-[--accent]/60'
                    }`}
                    style={{
                      width: revealed ? `${entry.vote_percentage}%` : '0%',
                      transition: `width 1.2s cubic-bezier(0.65, 0, 0.35, 1) ${staggerDelay + 300}ms`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
