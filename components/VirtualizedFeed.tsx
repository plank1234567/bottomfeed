'use client';

import { useCallback, useMemo, type ReactNode, type ReactElement, type CSSProperties } from 'react';
import { List, useDynamicRowHeight } from 'react-window';
import type { Post } from '@/types';

interface VirtualizedFeedProps {
  posts: Post[];
  renderPost: (post: Post, index: number) => ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  endMessage?: ReactNode;
}

const ESTIMATED_ROW_HEIGHT = 200;
const OVERSCAN_COUNT = 5;

// Custom props passed to each row via List's rowProps
interface FeedRowProps {
  posts: Post[];
  renderPost: (post: Post, index: number) => ReactNode;
  loadingMore?: boolean;
  endMessage?: ReactNode;
}

/**
 * Row component for react-window v2 List.
 * Receives { ariaAttributes, index, style } from List + custom FeedRowProps.
 */
function FeedRow({
  index,
  style,
  posts,
  renderPost,
  loadingMore,
  endMessage,
}: {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
} & FeedRowProps): ReactElement | null {
  // Last row: loading spinner or end message
  if (index >= posts.length) {
    return (
      <div style={style}>
        {loadingMore ? (
          <div className="flex justify-center py-8" role="status" aria-label="Loading more posts">
            <div
              className="w-6 h-6 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span className="sr-only">Loading more posts...</span>
          </div>
        ) : (
          <>{endMessage}</>
        )}
      </div>
    );
  }

  const post = posts[index]!;
  return <div style={style}>{renderPost(post, index)}</div>;
}

/**
 * Virtualized post feed using react-window v2.
 * Only renders visible posts + overscan, preventing DOM bloat.
 * Falls back to regular rendering for small lists (<20 posts).
 */
export default function VirtualizedFeed({
  posts,
  renderPost,
  onLoadMore,
  hasMore,
  loadingMore,
  endMessage,
}: VirtualizedFeedProps) {
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: ESTIMATED_ROW_HEIGHT,
  });

  // Trigger load more when scrolling near bottom (must be before early return)
  const onRowsRendered = useCallback(
    (visibleRows: { startIndex: number; stopIndex: number }) => {
      if (hasMore && !loadingMore && visibleRows.stopIndex >= posts.length - 3) {
        onLoadMore?.();
      }
    },
    [hasMore, loadingMore, posts.length, onLoadMore]
  );

  // Memoize rowProps to prevent re-renders of List when only parent re-renders
  // (must be before early return to satisfy React hooks rules)
  const memoizedRowProps = useMemo<FeedRowProps>(
    () => ({ posts, renderPost, loadingMore, endMessage }),
    [posts, renderPost, loadingMore, endMessage]
  );

  // For small lists, just render normally — virtualization overhead isn't worth it
  if (posts.length < 20) {
    return (
      <div>
        {posts.map((post, i) => (
          <div key={post.id}>{renderPost(post, i)}</div>
        ))}
        {loadingMore && (
          <div className="flex justify-center py-8" role="status" aria-label="Loading more posts">
            <div
              className="w-6 h-6 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span className="sr-only">Loading more posts...</span>
          </div>
        )}
        {!hasMore && posts.length > 0 && endMessage}
      </div>
    );
  }

  // Total rows = posts + optional loading/end row
  const rowCount = posts.length + (loadingMore || (!hasMore && posts.length > 0) ? 1 : 0);

  return (
    <List<FeedRowProps>
      rowCount={rowCount}
      rowHeight={dynamicRowHeight}
      rowComponent={FeedRow}
      rowProps={memoizedRowProps}
      overscanCount={OVERSCAN_COUNT}
      onRowsRendered={onRowsRendered}
      style={{ height: 'calc(100vh - 56px)', width: '100%' }}
    />
  );
}
