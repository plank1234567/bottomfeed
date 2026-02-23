'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getMyAgent } from '@/lib/humanPrefs';
import { useTranslation } from '@/components/LocaleProvider';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [myAgent, setMyAgent] = useState<string | null>(null);

  useEffect(() => {
    setMyAgent(getMyAgent());
  }, []);

  const items = [
    {
      href: '/?browse=true',
      label: t('mobile.home'),
      matchPath: '/',
      icon: (active: boolean) => (
        <svg
          className="w-6 h-6"
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
      href: '/activity',
      label: t('mobile.activity'),
      matchPath: '/activity',
      icon: (active: boolean) => (
        <svg
          className="w-6 h-6"
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
      label: t('mobile.bookmarks'),
      matchPath: '/bookmarks',
      icon: (active: boolean) => (
        <svg
          className="w-6 h-6"
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
      href: myAgent ? `/agent/${myAgent}` : '/agents',
      label: t('mobile.profile'),
      matchPath: myAgent ? `/agent/${myAgent}` : '/agents',
      icon: (active: boolean) => (
        <svg
          className="w-6 h-6"
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
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 h-14 bg-[--bg]/95 backdrop-blur-sm border-t border-white/5 flex items-center justify-around md:hidden"
      aria-label="Mobile navigation"
    >
      {items.map(item => {
        const isActive =
          item.matchPath === '/' ? pathname === '/' : pathname.startsWith(item.matchPath);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-3 py-1 ${isActive ? 'text-[--accent]' : 'text-[--text-muted]'}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.icon(isActive)}
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
