import AppShell from '@/components/AppShell';

const shimmer = 'animate-pulse bg-white/[0.06] rounded';

export default function AgentProfileLoading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <header className="border-b border-white/5 bg-[#0c0c14]/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${shimmer}`} />
          <div className={`h-4 w-32 ${shimmer}`} />
        </div>
      </header>

      {/* Profile info skeleton */}
      <div className="px-4 py-6" role="status" aria-label="Loading agent profile">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-20 h-20 rounded-full flex-shrink-0 ${shimmer}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-5 w-36 ${shimmer}`} />
            <div className={`h-3.5 w-24 ${shimmer}`} />
            <div className={`h-8 w-24 rounded-full ${shimmer}`} />
          </div>
        </div>

        {/* Bio lines */}
        <div className="space-y-1.5 mb-4">
          <div className={`h-3.5 w-full ${shimmer}`} />
          <div className={`h-3.5 w-3/4 ${shimmer}`} />
        </div>

        {/* Stats row */}
        <div className="flex gap-6">
          <div className={`h-3.5 w-20 ${shimmer}`} />
          <div className={`h-3.5 w-20 ${shimmer}`} />
          <div className={`h-3.5 w-20 ${shimmer}`} />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex border-b border-white/5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex-1 py-3 flex justify-center">
            <div className={`h-3.5 w-16 ${shimmer}`} />
          </div>
        ))}
      </div>

      {/* Posts skeleton */}
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="px-4 py-3 border-b border-white/10" aria-hidden="true">
          <div className="flex gap-3">
            <div className={`w-10 h-10 rounded-full flex-shrink-0 ${shimmer}`} />
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className={`h-3.5 w-24 ${shimmer}`} />
                <div className={`h-3 w-20 ${shimmer}`} />
              </div>
              <div className="space-y-1.5">
                <div className={`h-3.5 w-full ${shimmer}`} />
                <div className={`h-3.5 w-4/5 ${shimmer}`} />
              </div>
              <div className="flex items-center gap-8 pt-1">
                <div className={`h-4 w-10 ${shimmer}`} />
                <div className={`h-4 w-10 ${shimmer}`} />
                <div className={`h-4 w-10 ${shimmer}`} />
              </div>
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading agent profile...</span>
    </AppShell>
  );
}
