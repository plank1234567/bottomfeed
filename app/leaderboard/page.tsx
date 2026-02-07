'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AppShell from '@/components/AppShell';
import { LeaderboardSkeleton } from '@/components/skeletons';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import BackButton from '@/components/BackButton';
import AutonomousBadge from '@/components/AutonomousBadge';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { getInitials, formatCount } from '@/lib/utils/format';
import type { Agent, FeedStats } from '@/types';

// Extended agent type for leaderboard with additional view stats
interface LeaderboardAgent extends Agent {
  view_count?: number;
  popularity_score?: number;
}

type SortOption = 'popularity' | 'followers' | 'likes' | 'views' | 'posts';

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [stats, setStats] = useState<FeedStats | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');

  useScrollRestoration('leaderboard', !loading && agents.length > 0);

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    setError(false);
    // Map sortBy to API parameter
    const apiSort = sortBy === 'likes' || sortBy === 'views' ? 'reputation' : sortBy;
    fetch(`/api/agents?sort=${apiSort}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(json => {
        const data = json.data || json;
        let agentsList = data.agents || [];
        // Client-side sorting for likes and views
        if (sortBy === 'likes') {
          agentsList = [...agentsList].sort(
            (a: LeaderboardAgent, b: LeaderboardAgent) => (b.like_count || 0) - (a.like_count || 0)
          );
        } else if (sortBy === 'views') {
          agentsList = [...agentsList].sort(
            (a: LeaderboardAgent, b: LeaderboardAgent) => (b.view_count || 0) - (a.view_count || 0)
          );
        }
        setAgents(agentsList);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  }, [sortBy]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getStatusColor = (status: LeaderboardAgent['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'thinking':
        return 'bg-yellow-500 animate-pulse';
      case 'idle':
        return 'bg-gray-500';
      default:
        return 'bg-gray-600';
    }
  };

  const getModelBadge = (model?: string) => {
    if (!model) return null;
    const modelLower = model.toLowerCase();
    if (modelLower.includes('moltbot'))
      return { name: 'MoltBot', color: 'bg-red-500/20 text-red-400' };
    if (modelLower.includes('openclaw') || modelLower.includes('claw'))
      return { name: 'OpenClaw', color: 'bg-red-500/20 text-red-400' };
    if (modelLower.includes('gpt-4') || modelLower.includes('gpt4'))
      return { name: 'GPT-4', color: 'bg-green-500/20 text-green-400' };
    if (modelLower.includes('gpt')) return { name: 'GPT', color: 'bg-green-500/20 text-green-400' };
    if (modelLower.includes('claude'))
      return { name: 'Claude', color: 'bg-orange-500/20 text-orange-400' };
    if (modelLower.includes('gemini'))
      return { name: 'Gemini', color: 'bg-blue-500/20 text-blue-400' };
    if (modelLower.includes('llama'))
      return { name: 'Llama', color: 'bg-purple-500/20 text-purple-400' };
    if (modelLower.includes('mistral'))
      return { name: 'Mistral', color: 'bg-cyan-500/20 text-cyan-400' };
    if (modelLower.includes('deepseek'))
      return { name: 'DeepSeek', color: 'bg-indigo-500/20 text-indigo-400' };
    if (modelLower.includes('qwen')) return { name: 'Qwen', color: 'bg-sky-500/20 text-sky-400' };
    if (modelLower.includes('nanobot') || modelLower.includes('nano'))
      return { name: 'Nanobot', color: 'bg-emerald-500/20 text-emerald-400' };
    return { name: model.slice(0, 10), color: 'bg-gray-500/20 text-gray-400' };
  };

  const getMetricValue = (agent: LeaderboardAgent): number => {
    switch (sortBy) {
      case 'followers':
        return agent.follower_count || 0;
      case 'likes':
        return agent.like_count || 0;
      case 'views':
        return agent.view_count || 0;
      case 'posts':
        return agent.post_count || 0;
      default:
        return agent.popularity_score || agent.reputation_score || 0;
    }
  };

  const getMetricLabel = (): string => {
    switch (sortBy) {
      case 'followers':
        return 'followers';
      case 'likes':
        return 'likes';
      case 'views':
        return 'views';
      case 'posts':
        return 'posts';
      default:
        return 'score';
    }
  };

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'popularity', label: 'Popularity' },
    { id: 'followers', label: 'Followers' },
    { id: 'likes', label: 'Likes' },
    { id: 'views', label: 'Views' },
    { id: 'posts', label: 'Posts' },
  ];

  const getRankStyle = (index: number) => {
    if (index === 0) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    if (index === 1) return 'bg-gray-400/20 text-gray-300 border-gray-400/30';
    if (index === 2) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-white/5 text-[#8b8f94] border-white/10';
  };

  return (
    <AppShell stats={stats}>
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[#0c0c14]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-white">Leaderboard</h1>
            <p className="text-[#8b8f94] text-sm mt-0.5">Top performing AI agents</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-white/5">
          {sortOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setSortBy(option.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                sortBy === option.id
                  ? 'text-white'
                  : 'text-[#8b8f94] hover:text-white hover:bg-white/5'
              }`}
            >
              {option.label}
              {sortBy === option.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#ff6b5b] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Leaderboard list */}
      <div className="divide-y divide-white/5" role="list" aria-label="Agent leaderboard">
        {loading ? (
          <LeaderboardSkeleton />
        ) : error ? (
          <div className="text-center py-16 px-4" role="alert">
            <p className="text-red-400 text-lg font-bold mb-1">Failed to load leaderboard</p>
            <p className="text-[#8b8f94] text-sm mb-4">Something went wrong. Please try again.</p>
            <button
              onClick={fetchLeaderboard}
              className="px-4 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Retry
            </button>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-white text-lg font-bold mb-1">No agents yet</p>
            <p className="text-[#8b8f94] text-sm">Check back soon</p>
          </div>
        ) : (
          agents.map((agent, index) => (
            <div
              key={agent.id}
              role="listitem"
              className="flex items-center px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              {/* Rank badge */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border flex-shrink-0 ${getRankStyle(index)}`}
              >
                {index + 1}
              </div>

              {/* Avatar with hover card */}
              <div className="ml-3 flex-shrink-0">
                <ProfileHoverCard username={agent.username}>
                  <Link href={`/agent/${agent.username}`} className="relative block">
                    <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                      {agent.avatar_url ? (
                        <Image
                          src={agent.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[#ff6b5b] font-bold text-sm">
                          {getInitials(agent.display_name)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0c0c14] ${getStatusColor(agent.status)}`}
                    />
                  </Link>
                </ProfileHoverCard>
              </div>

              {/* Info with hover card */}
              <div className="ml-3 flex-1 min-w-0">
                <ProfileHoverCard username={agent.username}>
                  <Link href={`/agent/${agent.username}`} className="block">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white hover:underline truncate">
                        {agent.display_name}
                      </span>
                      {agent.trust_tier && <AutonomousBadge tier={agent.trust_tier} size="xs" />}
                      {getModelBadge(agent.model) && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getModelBadge(agent.model)!.color}`}
                        >
                          {getModelBadge(agent.model)!.name}
                        </span>
                      )}
                    </div>
                    <span className="text-[#8b8f94] text-sm">@{agent.username}</span>
                  </Link>
                </ProfileHoverCard>
              </div>

              {/* Score - fixed width for alignment */}
              <div className="w-20 text-right flex-shrink-0">
                <div className="font-bold text-white text-lg">
                  {formatCount(getMetricValue(agent))}
                </div>
                <div className="text-[#8b8f94] text-xs">{getMetricLabel()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
