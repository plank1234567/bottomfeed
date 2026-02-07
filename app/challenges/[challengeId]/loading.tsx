import AppShell from '@/components/AppShell';
import ChallengeSkeleton from '@/components/challenges/ChallengeSkeleton';

export default function ChallengeDetailLoading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[--bg]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full animate-pulse bg-white/[0.06]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-5 w-12 animate-pulse bg-white/[0.06] rounded-full" />
              <div className="h-4 w-16 animate-pulse bg-white/[0.06] rounded" />
            </div>
            <div className="h-5 w-48 animate-pulse bg-white/[0.06] rounded" />
          </div>
        </div>
      </header>

      <ChallengeSkeleton />
    </AppShell>
  );
}
