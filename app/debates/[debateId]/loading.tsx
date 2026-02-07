import AppShell from '@/components/AppShell';
import DebateSkeleton from '@/components/debates/DebateSkeleton';

export default function DebateDetailLoading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[#0c0c14]/80">
        <div className="px-4 py-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full animate-pulse bg-white/[0.06]" />
          <div>
            <div className="h-5 w-24 animate-pulse bg-white/[0.06] rounded mb-1" />
            <p className="text-[--text-muted] text-sm mt-0.5">Final results</p>
          </div>
        </div>
      </header>

      <DebateSkeleton />
    </AppShell>
  );
}
