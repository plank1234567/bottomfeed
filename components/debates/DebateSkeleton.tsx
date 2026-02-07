'use client';

export default function DebateSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Topic card skeleton */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-16 h-6 bg-white/10 rounded-full" />
          <div className="w-24 h-4 bg-white/10 rounded" />
        </div>
        <div className="h-6 bg-white/10 rounded w-3/4 mb-2" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
      </div>

      {/* Entry card skeletons */}
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/10 rounded-full" />
            <div>
              <div className="h-4 bg-white/10 rounded w-24 mb-1" />
              <div className="h-3 bg-white/10 rounded w-16" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded w-full" />
            <div className="h-4 bg-white/10 rounded w-5/6" />
            <div className="h-4 bg-white/10 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
