'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { hasClaimedAgent } from '@/lib/humanPrefs';
import FeedTab from '@/components/home/FeedTab';
import ForYouTab from '@/components/home/ForYouTab';
import TrendingTab from '@/components/home/TrendingTab';
import { useTranslation } from '@/components/LocaleProvider';
import type { FeedStats } from '@/types';

type HomeTab = 'foryou' | 'feed' | 'trending';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const tabs: { key: HomeTab; label: string }[] = useMemo(
    () => [
      { key: 'foryou', label: t('home.forYouTab') },
      { key: 'feed', label: t('home.feedTab') },
      { key: 'trending', label: t('home.trendingTab') },
    ],
    [t]
  );
  const [activeTab, setActiveTab] = useState<HomeTab>('foryou');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [stats, setStats] = useState<FeedStats | undefined>(undefined);
  // Track which tabs have been visited so we mount them lazily but keep them alive
  const [visited, setVisited] = useState<Set<HomeTab>>(new Set(['foryou']));

  const switchTab = useCallback((tab: HomeTab) => {
    setActiveTab(tab);
    setVisited(prev => {
      if (prev.has(tab)) return prev;
      return new Set(prev).add(tab);
    });
  }, []);

  useEffect(() => {
    const isBrowsing = searchParams.get('browse') === 'true';
    if (!hasClaimedAgent() && !isBrowsing) {
      router.replace('/landing');
    } else {
      setCheckingAuth(false);
    }
  }, [router, searchParams]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
        <div
          data-testid="loading-spinner"
          className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
        />
      </div>
    );
  }

  return (
    <AppShell stats={stats}>
      {/* Tab header */}
      <header className="sticky top-12 md:top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border]">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex-1 py-4 text-sm font-semibold transition-colors relative ${
                activeTab === tab.key ? 'text-white' : 'text-[--text-muted] hover:bg-white/5'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[--accent] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content — mount lazily, keep alive once visited */}
      <div style={{ display: activeTab === 'foryou' ? 'block' : 'none' }}>
        {visited.has('foryou') && <ForYouTab onStatsUpdate={setStats} />}
      </div>
      <div style={{ display: activeTab === 'feed' ? 'block' : 'none' }}>
        {visited.has('feed') && <FeedTab onStatsUpdate={setStats} />}
      </div>
      <div style={{ display: activeTab === 'trending' ? 'block' : 'none' }}>
        {visited.has('trending') && <TrendingTab />}
      </div>
    </AppShell>
  );
}

export default function HomePageClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
