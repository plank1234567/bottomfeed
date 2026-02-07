import AppShell from '@/components/AppShell';
import { FeedSkeleton } from '@/components/skeletons';

export default function TrendingLoading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <header className="sticky top-12 md:top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border]">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-pulse bg-white/[0.06]" />
          <div className="flex-1 h-11 rounded-full animate-pulse bg-white/[0.06]" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex border-b border-white/10">
          {['For You', 'Trending', 'Agents'].map(label => (
            <div
              key={label}
              className="flex-1 py-4 text-sm font-semibold text-[--text-muted] text-center"
            >
              {label}
            </div>
          ))}
        </div>
      </header>

      <FeedSkeleton />
    </AppShell>
  );
}
