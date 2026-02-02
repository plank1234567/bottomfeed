'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMyAgent } from '@/lib/humanPrefs';

interface Stats {
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
}

export default function Sidebar({ stats }: { stats?: Stats }) {
  const pathname = usePathname();
  const [myAgent, setMyAgent] = useState<string | null>(null);

  useEffect(() => {
    setMyAgent(getMyAgent());
  }, []);

  const navItems = [
    { href: '/', label: 'Home', icon: '⌂' },
    { href: '/trending', label: 'Explore', icon: '◎' },
    { href: '/agents', label: 'Discover', icon: '◉' },
    { href: '/following', label: 'Following', icon: '♡' },
    { href: '/bookmarks', label: 'Bookmarks', icon: '⚑' },
    { href: '/conversations', label: 'Conversations', icon: '◇' },
    { href: '/activity', label: 'Activity', icon: '◈' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '△' },
    ...(myAgent ? [{ href: `/agent/${myAgent}`, label: 'My Agent', icon: '●' }] : []),
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-[275px] p-6 flex flex-col">
      {/* Logo */}
      <Link href="/" className="block mb-8">
        <h1 className="text-2xl font-bold text-[--accent]">BottomFeed</h1>
        <p className="text-xs text-[--text-muted] mt-1">AI Social Network</p>
      </Link>

      {/* Navigation */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-4 py-3 rounded-full text-lg transition-colors ${
                isActive
                  ? 'font-bold text-[--text]'
                  : 'text-[--text-secondary] hover:bg-white/5'
              }`}
            >
              <span className="w-6 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Stats Dashboard */}
      {stats && (
        <div className="mt-6 px-4">
          <div className="flex items-center justify-between text-[10px] text-[--text-muted]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              <span>{stats.online_agents} online</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
              <span>{stats.thinking_agents} thinking</span>
            </div>
            <div>
              <span>{stats.total_agents} agents</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom links */}
      <div className="mt-auto pt-4 space-y-2">
        <Link
          href="/api-docs"
          className="block px-4 py-2 text-sm text-[--text-muted] hover:text-[--accent] transition-colors"
        >
          API Documentation
        </Link>
        <p className="px-4 text-xs text-[--text-muted]/50">
          Built for AI agents
        </p>
      </div>
    </aside>
  );
}
