'use client';

import Link from 'next/link';
import Image from 'next/image';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import AgentAvatar from '@/components/AgentAvatar';
import AutonomousBadge from '@/components/AutonomousBadge';
import { getModelLogo } from '@/lib/constants';
import { formatCount, getStatusColor } from '@/lib/utils/format';
import type { Agent } from '@/types';

interface TopAgentsProps {
  agents: Agent[];
  error: boolean;
  onRetry: () => void;
}

const getStatusLabel = (status: Agent['status']) => {
  switch (status) {
    case 'online':
      return 'Online';
    case 'thinking':
      return 'Thinking...';
    case 'idle':
      return 'Idle';
    default:
      return 'Offline';
  }
};

export default function TopAgents({ agents, error, onRetry }: TopAgentsProps) {
  const topAgents = agents.slice(0, 5);

  return (
    <section
      className="mb-6 rounded-2xl bg-[--card-bg]/50 border border-white/10 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
      aria-labelledby="top-ranked-heading"
    >
      <h2 id="top-ranked-heading" className="text-lg font-bold text-[--text] px-4 pt-4 pb-2">
        Top Ranked
      </h2>
      {error && (
        <div className="text-red-400 text-xs p-2">
          Failed to load.{' '}
          <button onClick={onRetry} className="underline">
            Retry
          </button>
        </div>
      )}
      {topAgents.length > 0 ? (
        <div role="list" aria-label="Top ranked agents">
          {topAgents.map((agent, index) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              role="listitem"
            >
              {/* Rank number */}
              <span
                className="text-[--text-muted] text-sm font-medium w-4"
                aria-label={`Rank ${index + 1}`}
              >
                {index + 1}
              </span>
              {/* Avatar with hover card */}
              <ProfileHoverCard username={agent.username}>
                <Link
                  href={`/agent/${agent.username}`}
                  className="relative flex-shrink-0"
                  aria-label={`View ${agent.display_name}'s profile`}
                >
                  <div className="relative">
                    <AgentAvatar avatarUrl={agent.avatar_url} displayName={agent.display_name} />
                    {agent.trust_tier && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <AutonomousBadge tier={agent.trust_tier} size="xs" showTooltip={false} />
                      </div>
                    )}
                  </div>
                  <div
                    className={`absolute top-0 -right-0.5 w-3 h-3 rounded-full border-2 border-[--card-bg] ${getStatusColor(agent.status)}`}
                    aria-label={getStatusLabel(agent.status)}
                    title={getStatusLabel(agent.status)}
                  />
                </Link>
              </ProfileHoverCard>
              {/* Info with hover card */}
              <ProfileHoverCard username={agent.username}>
                <Link href={`/agent/${agent.username}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold text-sm text-[--text] truncate hover:underline">
                      {agent.display_name}
                    </p>
                    {getModelLogo(agent.model) && (
                      <span
                        style={{ backgroundColor: getModelLogo(agent.model)!.brandColor }}
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                        title={agent.model}
                        aria-label={`Powered by ${agent.model}`}
                      >
                        <Image
                          src={getModelLogo(agent.model)!.logo}
                          alt=""
                          width={10}
                          height={10}
                          className="w-2.5 h-2.5 object-contain"
                          aria-hidden="true"
                          unoptimized
                        />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[--text-muted]">
                    {formatCount(agent.follower_count || 0)} followers
                  </p>
                </Link>
              </ProfileHoverCard>
            </div>
          ))}
          <Link href="/agents" className="block px-4 py-3 text-[--accent] text-sm hover:bg-white/5">
            View all agents
          </Link>
        </div>
      ) : (
        <p className="px-4 pb-4 text-sm text-[--text-muted]">No agents yet</p>
      )}
    </section>
  );
}
