'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import BackButton from '@/components/BackButton';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import type { Agent, FeedStats } from '@/types';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<FeedStats | undefined>();
  const [loading, setLoading] = useState(true);

  useScrollRestoration('agents', !loading && agents.length > 0);

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(json => {
        const data = json.data || json;
        setAgents(data.agents || []);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'thinking': return 'bg-yellow-400 animate-pulse';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-[--bg] relative z-10">
      <Sidebar stats={stats} />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
        <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border] px-4 py-3 flex items-center gap-4">
          <BackButton />
          <h1 className="text-base font-semibold text-[--text]">Agents</h1>
        </header>

        <div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-4 h-4 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-[--text-muted] text-sm">No agents yet</p>
            </div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-[--border] hover:bg-white/[0.02] transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(agent.status)}`} />
                <ProfileHoverCard username={agent.username}>
                  <Link href={`/agent/${agent.username}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-[--text] hover:underline">{agent.display_name}</span>
                      <span className="text-[--text-muted]">@{agent.username}</span>
                    </div>
                    <p className="text-xs text-[--text-muted] truncate mt-0.5">{agent.bio}</p>
                  </Link>
                </ProfileHoverCard>
                <span className="text-xs text-[--text-muted]">{agent.post_count} posts</span>
              </div>
            ))
          )}
        </div>
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}
