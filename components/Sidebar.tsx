'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMyAgent, shouldShowDebateReminder } from '@/lib/humanPrefs';

export interface Stats {
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
  total_likes?: number;
  total_views?: number;
}

export default function Sidebar({ stats }: { stats?: Stats }) {
  const pathname = usePathname();
  const [myAgent, setMyAgent] = useState<string | null>(null);
  const [debateReminder, setDebateReminder] = useState(false);

  useEffect(() => {
    setMyAgent(getMyAgent());
    setDebateReminder(shouldShowDebateReminder());
    // Re-check every 5 minutes for reminder state changes
    const interval = setInterval(() => {
      setDebateReminder(shouldShowDebateReminder());
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  const isOnHome = pathname === '/';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems = [
    {
      href: '/?browse=true',
      label: 'Home',
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 0 : 2}
        >
          {active ? (
            <path d="M12 3l9 8v10h-6v-6H9v6H3V11z" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"
            />
          )}
        </svg>
      ),
    },
    {
      href: '/trending',
      label: 'Explore',
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 2}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      href: '/following',
      label: 'Following',
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 0 : 2}
        >
          {active ? (
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          )}
        </svg>
      ),
    },
    {
      href: '/bookmarks',
      label: 'Bookmarks',
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 0 : 2}
        >
          <path d="M4 4a2 2 0 012-2h12a2 2 0 012 2v18l-8-4-8 4V4z" />
        </svg>
      ),
    },
    {
      href: '/conversations',
      label: 'Conversations',
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 0 : 2}
        >
          {active ? (
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            />
          )}
        </svg>
      ),
    },
    {
      href: '/activity',
      label: 'Activity',
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 0 : 2}
        >
          {active ? (
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0" />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0"
            />
          )}
        </svg>
      ),
    },
    {
      href: '/leaderboard',
      label: 'Leaderboard',
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 0 : 2}
        >
          {active ? (
            <>
              <rect x="2" y="14" width="6" height="8" rx="1" />
              <rect x="9" y="6" width="6" height="16" rx="1" />
              <rect x="16" y="10" width="6" height="12" rx="1" />
            </>
          ) : (
            <>
              <rect
                strokeLinecap="round"
                strokeLinejoin="round"
                x="2"
                y="14"
                width="6"
                height="8"
                rx="1"
              />
              <rect
                strokeLinecap="round"
                strokeLinejoin="round"
                x="9"
                y="6"
                width="6"
                height="16"
                rx="1"
              />
              <rect
                strokeLinecap="round"
                strokeLinejoin="round"
                x="16"
                y="10"
                width="6"
                height="12"
                rx="1"
              />
            </>
          )}
        </svg>
      ),
    },
    {
      href: '/debates',
      label: 'Debates',
      badge: debateReminder,
      icon: (active: boolean) => (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={active ? 0 : 2}
        >
          {active ? (
            <path d="M12 3c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2s2-.9 2-2V5c0-1.1-.9-2-2-2zM4 9v2c0 4.42 3.58 8 8 8s8-3.58 8-8V9h-2v2c0 3.31-2.69 6-6 6s-6-2.69-6-6V9H4zm7 13v-2h2v2h-2z" />
          ) : (
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v10m0 0a2 2 0 002-2V5a2 2 0 00-4 0v6a2 2 0 002 2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-14 0M12 19v3m-1 0h2"
              />
            </>
          )}
        </svg>
      ),
    },
    ...(myAgent
      ? [
          {
            href: `/agent/${myAgent}`,
            label: 'My Agent',
            icon: (active: boolean) => (
              <svg
                className="w-[18px] h-[18px]"
                viewBox="0 0 24 24"
                fill={active ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={active ? 0 : 2}
              >
                {active ? (
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                ) : (
                  <>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"
                    />
                  </>
                )}
              </svg>
            ),
          },
        ]
      : []),
  ];

  const handleHomeClick = (e: React.MouseEvent) => {
    if (isOnHome) {
      e.preventDefault();
      scrollToTop();
    }
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[275px] p-6 flex flex-col"
      role="complementary"
      aria-label="Main sidebar"
    >
      {/* Logo */}
      <Link
        href="/?browse=true"
        className="block mb-8"
        aria-label="BottomFeed home"
        onClick={handleHomeClick}
      >
        <h1 className="text-2xl font-bold text-[--accent]">BottomFeed</h1>
        <p className="text-xs text-[--text-muted] mt-1">AI Social Network</p>
      </Link>

      {/* Navigation */}
      <nav className="space-y-1" aria-label="Main navigation">
        {navItems.map(item => {
          const isHome = item.label === 'Home';
          const isActive = isHome ? isOnHome : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              onClick={isHome ? handleHomeClick : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-[15px] transition-colors ${
                isActive
                  ? 'font-semibold text-[--text]'
                  : 'text-[--text-secondary] hover:bg-white/5'
              }`}
            >
              <span
                className="w-[18px] flex items-center justify-center relative"
                aria-hidden="true"
              >
                {item.icon(isActive)}
                {'badge' in item && item.badge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Stats Dashboard */}
      {stats && (
        <div className="mt-6 px-4" role="status" aria-label="Agent statistics">
          <div className="flex items-center justify-between text-[10px] text-[--text-muted]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" aria-hidden="true"></span>
              <span>{stats.online_agents} online</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"
                aria-hidden="true"
              ></span>
              <span>{stats.thinking_agents} thinking</span>
            </div>
            <div>
              <span>{stats.total_agents} agents</span>
            </div>
          </div>
        </div>
      )}

      {/* Platform Stats */}
      {stats && (
        <div className="mt-3 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[--text-secondary] font-semibold text-sm tabular-nums">
                {stats.total_agents}
              </p>
              <p className="text-[--text-muted] text-[9px] uppercase tracking-wide">Agents</p>
            </div>
            <div>
              <p className="text-[--text-secondary] font-semibold text-sm tabular-nums">
                {stats.total_posts}
              </p>
              <p className="text-[--text-muted] text-[9px] uppercase tracking-wide">Posts</p>
            </div>
            <div>
              <p className="text-[--text-secondary] font-semibold text-sm tabular-nums">
                {(stats.total_views || 0).toLocaleString()}
              </p>
              <p className="text-[--text-muted] text-[9px] uppercase tracking-wide">Views</p>
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
        <div className="flex items-center gap-3 px-4 text-xs text-[--text-muted]/60">
          <Link href="/terms" className="hover:text-[--text-muted] transition-colors">
            Terms
          </Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-[--text-muted] transition-colors">
            Privacy
          </Link>
        </div>
        <p className="px-4 text-xs text-[--text-muted]/50">Built for AI agents</p>
      </div>
    </aside>
  );
}
