'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useFeedStream } from '@/hooks/useFeedStream';
import PostCard from '@/components/post-card';
import EmptyState from '@/components/EmptyState';
import PostModal from '@/components/PostModal';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { getPageCacheEntry, setPageCacheEntry } from '@/hooks/usePageCache';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { useTranslation } from '@/components/LocaleProvider';
import type { Post, FeedStats } from '@/types';

interface FeedCacheData {
  posts: Post[];
  stats?: FeedStats;
  nextCursor: string | null;
  latestPostId: string | null;
}

interface FeedTabProps {
  onStatsUpdate?: (stats: FeedStats) => void;
}

export default function FeedTab({ onStatsUpdate }: FeedTabProps) {
  const { t } = useTranslation();
  const cachedFeed = getPageCacheEntry<FeedCacheData>('feed');
  const [posts, setPosts] = useState<Post[]>(cachedFeed?.posts || []);
  const [newPosts, setNewPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(!cachedFeed);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{ id: string; post?: Post } | null>(null);
  const [hasMore, setHasMore] = useState(cachedFeed ? !!cachedFeed.nextCursor : true);
  const latestPostId = useRef<string | null>(cachedFeed?.latestPostId || null);
  const nextCursor = useRef<string | null>(cachedFeed?.nextCursor || null);
  const initialLoadDone = useRef(!!cachedFeed);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useScrollRestoration('feed', !loading && posts.length > 0);

  const fetchFeed = useCallback(async () => {
    setError(false);
    try {
      const res = await fetchWithTimeout('/api/feed');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        const fetchedPosts = data.posts || [];
        setPosts(fetchedPosts);
        if (data.stats) onStatsUpdate?.(data.stats);
        nextCursor.current = data.next_cursor || null;
        setHasMore(!!data.next_cursor);
        if (fetchedPosts.length > 0) {
          latestPostId.current = fetchedPosts[0].id;
        }
        initialLoadDone.current = true;
        setPageCacheEntry<FeedCacheData>('feed', {
          posts: fetchedPosts,
          stats: data.stats,
          nextCursor: data.next_cursor || null,
          latestPostId: fetchedPosts[0]?.id || null,
        });
      } else if (!initialLoadDone.current) {
        setError(true);
      }
    } catch {
      if (!initialLoadDone.current) {
        setError(true);
      }
    }
    setLoading(false);
  }, [onStatsUpdate]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor.current) return;
    setLoadingMore(true);
    try {
      const res = await fetchWithTimeout(
        `/api/feed?cursor=${encodeURIComponent(nextCursor.current)}`
      );
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        const olderPosts: Post[] = data.posts || [];
        if (olderPosts.length === 0) {
          setHasMore(false);
        } else {
          setPosts(prev => [...prev, ...olderPosts]);
          nextCursor.current = data.next_cursor || null;
          setHasMore(!!data.next_cursor);
        }
      }
    } catch {
      // Silent fail on load more
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore]);

  const handleNewPosts = useCallback((incoming: Post[]) => {
    if (!initialLoadDone.current) return;
    setNewPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const novel = incoming.filter(p => !existingIds.has(p.id) && p.id !== latestPostId.current);
      return novel.length > 0 ? [...novel, ...prev] : prev;
    });
  }, []);

  const pollForNewPosts = useCallback(async () => {
    if (!initialLoadDone.current) return;
    try {
      const res = await fetchWithTimeout('/api/feed');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        const fetchedPosts: Post[] = data.posts || [];
        if (data.stats) onStatsUpdate?.(data.stats);
        if (latestPostId.current && fetchedPosts.length > 0) {
          const newer: Post[] = [];
          for (const post of fetchedPosts) {
            if (post.id === latestPostId.current) break;
            newer.push(post);
          }
          if (newer.length > 0) {
            handleNewPosts(newer);
          }
        }
      }
    } catch {
      // Silent fail on polling
    }
  }, [handleNewPosts, onStatsUpdate]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Auto-retry on error after 3 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setLoading(true);
      fetchFeed();
    }, 3000);
    return () => clearTimeout(timer);
  }, [error, fetchFeed]);

  useFeedStream(handleNewPosts, pollForNewPosts, 15000);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const showNewPosts = () => {
    if (newPosts.length > 0) {
      setPosts(prev => [...newPosts, ...prev]);
      const firstPost = newPosts[0];
      if (firstPost) {
        latestPostId.current = firstPost.id;
      }
      setNewPosts([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePostClick = useCallback((postId: string, post?: Post) => {
    setSelectedPost({ id: postId, post });
  }, []);

  const { pullHandlers, pullIndicator } = usePullToRefresh({
    onRefresh: async () => {
      await fetchFeed();
    },
  });

  return (
    <>
      <div {...pullHandlers}>
        {pullIndicator}

        {newPosts.length > 0 && (
          <button
            onClick={showNewPosts}
            className="w-full py-3 text-[#ff6b5b] text-sm font-medium hover:bg-[#ff6b5b]/5 transition-colors border-b border-white/5"
            aria-live="polite"
          >
            Show {newPosts.length} new post{newPosts.length !== 1 ? 's' : ''}
          </button>
        )}

        <SectionErrorBoundary section="feed">
          <div role="feed" aria-label={t('home.postsHeading')} data-testid="feed-container">
            {loading || error ? (
              <div className="flex justify-center py-16">
                <div
                  className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
                  role="status"
                  aria-label={t('home.loadingFeed')}
                />
              </div>
            ) : posts.length === 0 ? (
              <EmptyState type="posts" />
            ) : (
              <>
                {posts.map(post => (
                  <PostCard key={post.id} post={post} onPostClick={handlePostClick} />
                ))}
                <div ref={loadMoreRef} className="h-1" />
                {loadingMore && (
                  <div
                    className="flex justify-center py-8"
                    role="status"
                    aria-label={t('home.loadingMorePosts')}
                  >
                    <div
                      className="w-6 h-6 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Loading more posts...</span>
                  </div>
                )}
                {!hasMore && posts.length > 0 && (
                  <div className="text-center py-8 text-[--text-muted] text-xs">
                    You&apos;ve reached the end
                  </div>
                )}
              </>
            )}
          </div>
        </SectionErrorBoundary>
      </div>

      {selectedPost && (
        <PostModal
          postId={selectedPost.id}
          onClose={() => setSelectedPost(null)}
          initialPost={selectedPost.post}
        />
      )}
    </>
  );
}
