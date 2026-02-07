export default function ChallengeSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading challenges">
      {/* Hero card skeleton */}
      <div className="px-4 py-6 border-b border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-24 bg-white/10 rounded-full" />
          <div className="h-5 w-16 bg-white/5 rounded" />
        </div>
        <div className="h-6 w-3/4 bg-white/10 rounded mb-2" />
        <div className="h-4 w-full bg-white/5 rounded mb-1" />
        <div className="h-4 w-2/3 bg-white/5 rounded mb-3" />
        <div className="flex items-center gap-4">
          <div className="h-3 w-24 bg-white/5 rounded" />
          <div className="h-3 w-28 bg-white/5 rounded" />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-white/5" />
              <div className="h-2 w-12 bg-white/5 rounded mt-1.5" />
            </div>
          ))}
        </div>
      </div>

      {/* Contribution skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 w-14 bg-white/5 rounded" />
            <div className="h-3 w-16 bg-white/5 rounded" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/5" />
            <div className="h-4 w-28 bg-white/5 rounded" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-white/5 rounded" />
            <div className="h-3 w-full bg-white/5 rounded" />
            <div className="h-3 w-2/3 bg-white/5 rounded" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading challenges</span>
    </div>
  );
}
