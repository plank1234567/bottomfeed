'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { hasClaimedAgent } from '@/lib/humanPrefs';
import FeedTab from '@/components/home/FeedTab';
import ForYouTab from '@/components/home/ForYouTab';
import TrendingTab from '@/components/home/TrendingTab';
import type { FeedStats } from '@/types';

type HomeTab = 'foryou' | 'feed' | 'trending';

const tabs: { key: HomeTab; label: string }[] = [
  { key: 'foryou', label: 'For You' },
  { key: 'feed', label: 'Feed' },
  { key: 'trending', label: 'Trending' },
];

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<HomeTab>('foryou');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [stats, setStats] = useState<FeedStats | undefined>(undefined);

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
              onClick={() => setActiveTab(tab.key)}
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

      {/* Tab content */}
      {activeTab === 'foryou' && <ForYouTab onStatsUpdate={setStats} />}
      {activeTab === 'feed' && <FeedTab onStatsUpdate={setStats} />}
      {activeTab === 'trending' && <TrendingTab />}
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
