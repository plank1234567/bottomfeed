/**
 * Skeleton loading placeholders — content-shaped pulse animations
 * that replace spinners for a smoother perceived loading experience.
 */

const shimmer = 'animate-pulse bg-white/[0.06] rounded';

/** Single post card skeleton */
export function PostCardSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-white/10" aria-hidden="true">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex-shrink-0 ${shimmer}`} />
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Name + handle + time */}
          <div className="flex items-center gap-2">
            <div className={`h-3.5 w-24 ${shimmer}`} />
            <div className={`h-3 w-20 ${shimmer}`} />
            <div className={`h-3 w-8 ${shimmer}`} />
          </div>
          {/* Content lines */}
          <div className="space-y-1.5">
            <div className={`h-3.5 w-full ${shimmer}`} />
            <div className={`h-3.5 w-4/5 ${shimmer}`} />
            <div className={`h-3.5 w-3/5 ${shimmer}`} />
          </div>
          {/* Action buttons row */}
          <div className="flex items-center gap-8 pt-1">
            <div className={`h-4 w-10 ${shimmer}`} />
            <div className={`h-4 w-10 ${shimmer}`} />
            <div className={`h-4 w-10 ${shimmer}`} />
            <div className={`h-4 w-10 ${shimmer}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Multiple post card skeletons for feed loading */
export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading posts">
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading posts...</span>
    </div>
  );
}

/** Agent list item skeleton */
export function AgentCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5" aria-hidden="true">
      <div className={`w-12 h-12 rounded-full flex-shrink-0 ${shimmer}`} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className={`h-3.5 w-28 ${shimmer}`} />
          <div className={`h-3 w-16 ${shimmer}`} />
        </div>
        <div className={`h-3 w-48 ${shimmer}`} />
      </div>
      <div className={`h-8 w-20 rounded-full ${shimmer}`} />
    </div>
  );
}

/** Multiple agent skeletons */
export function AgentListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading agents">
      {Array.from({ length: count }, (_, i) => (
        <AgentCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading agents...</span>
    </div>
  );
}

/** Activity feed item skeleton */
export function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4" aria-hidden="true">
      <div className={`w-9 h-9 rounded-full flex-shrink-0 ${shimmer}`} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full ${shimmer}`} />
          <div className={`h-3.5 w-48 ${shimmer}`} />
        </div>
        <div className={`h-3 w-20 ${shimmer}`} />
      </div>
    </div>
  );
}

/** Activity feed skeleton */
export function ActivitySkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading activity" className="divide-y divide-white/5">
      {Array.from({ length: count }, (_, i) => (
        <ActivityItemSkeleton key={i} />
      ))}
      <span className="sr-only">Loading activity...</span>
    </div>
  );
}

/** Leaderboard row skeleton */
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5" aria-hidden="true">
      <div className={`w-6 h-6 ${shimmer}`} />
      <div className={`w-10 h-10 rounded-full flex-shrink-0 ${shimmer}`} />
      <div className="flex-1 space-y-1.5">
        <div className={`h-3.5 w-32 ${shimmer}`} />
        <div className={`h-3 w-20 ${shimmer}`} />
      </div>
      <div className={`h-6 w-16 ${shimmer}`} />
    </div>
  );
}

/** Leaderboard skeleton */
export function LeaderboardSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading leaderboard">
      {Array.from({ length: count }, (_, i) => (
        <LeaderboardRowSkeleton key={i} />
      ))}
      <span className="sr-only">Loading leaderboard...</span>
    </div>
  );
}

/** Conversation card skeleton */
export function ConversationSkeleton() {
  return (
    <div className="px-4 py-4 border-b border-white/5" aria-hidden="true">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-5 h-5 rounded ${shimmer}`} />
        <div className={`h-3.5 w-40 ${shimmer}`} />
      </div>
      <div className="space-y-1.5 mb-2">
        <div className={`h-3.5 w-full ${shimmer}`} />
        <div className={`h-3.5 w-3/4 ${shimmer}`} />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          <div className={`w-6 h-6 rounded-full ${shimmer}`} />
          <div className={`w-6 h-6 rounded-full ${shimmer}`} />
        </div>
        <div className={`h-3 w-24 ${shimmer}`} />
      </div>
    </div>
  );
}

/** Conversations list skeleton */
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading conversations">
      {Array.from({ length: count }, (_, i) => (
        <ConversationSkeleton key={i} />
      ))}
      <span className="sr-only">Loading conversations...</span>
    </div>
  );
}
