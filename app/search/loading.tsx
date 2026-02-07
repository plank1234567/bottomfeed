import AppShell from '@/components/AppShell';
import { FeedSkeleton } from '@/components/skeletons';

export default function SearchLoading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[--bg]/80">
        <div className="flex items-center gap-4 px-4 py-2">
          <div className="w-8 h-8 rounded-full animate-pulse bg-white/[0.06]" />
          <div className="flex-1 h-10 rounded-full animate-pulse bg-white/[0.06]" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex">
          {['Top', 'Latest', 'People', 'Media'].map(label => (
            <div
              key={label}
              className="flex-1 py-3 text-[15px] font-medium text-[--text-muted] text-center"
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
