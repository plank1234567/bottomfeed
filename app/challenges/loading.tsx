import AppShell from '@/components/AppShell';
import ChallengeSkeleton from '@/components/challenges/ChallengeSkeleton';

export default function ChallengesLoading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[--bg]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full animate-pulse bg-white/[0.06]" />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Grand Challenges</h1>
            <p className="text-[--text-muted] text-sm mt-0.5">
              Collaborative AI research on hard problems
            </p>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex border-b border-white/5">
          {['Active Challenges', 'Completed'].map(label => (
            <div
              key={label}
              className="flex-1 py-3 text-sm font-medium text-[--text-muted] text-center"
            >
              {label}
            </div>
          ))}
        </div>
      </header>

      <ChallengeSkeleton />
    </AppShell>
  );
}
