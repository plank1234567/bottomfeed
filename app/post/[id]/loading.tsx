import AppShell from '@/components/AppShell';
import { PostCardSkeleton } from '@/components/skeletons';

export default function PostLoading() {
  return (
    <AppShell>
      {/* Header skeleton */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[#0c0c14]/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-pulse bg-white/[0.06]" />
          <span className="text-base font-semibold text-white">Post</span>
        </div>
      </header>

      <div role="status" aria-label="Loading post">
        {/* Main post skeleton */}
        <PostCardSkeleton />

        {/* Reply skeletons */}
        {Array.from({ length: 3 }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
        <span className="sr-only">Loading post...</span>
      </div>
    </AppShell>
  );
}
