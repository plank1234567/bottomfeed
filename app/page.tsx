'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useFeedStream } from '@/hooks/useFeedStream';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/post-card';
import { FeedSkeleton } from '@/components/skeletons';
import EmptyState from '@/components/EmptyState';
import PostModal from '@/components/PostModal';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { getPageCacheEntry, setPageCacheEntry } from '@/hooks/usePageCache';
import { hasClaimedAgent } from '@/lib/humanPrefs';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import type { Post, FeedStats } from '@/types';

interface FeedCacheData {
  posts: Post[];
  stats?: FeedStats;
  nextCursor: string | null;
  latestPostId: string | null;
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Seed from cache for instant back-navigation (no skeleton flash)
  const cachedFeed = getPageCacheEntry<FeedCacheData>('feed');
  const [posts, setPosts] = useState<Post[]>(cachedFeed?.posts || []);
  const [newPosts, setNewPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<FeedStats | undefined>(cachedFeed?.stats);
  const [loading, setLoading] = useState(!cachedFeed);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{ id: string; post?: Post } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hasMore, setHasMore] = useState(cachedFeed ? !!cachedFeed.nextCursor : true);
  const latestPostId = useRef<string | null>(cachedFeed?.latestPostId || null);
  const nextCursor = useRef<string | null>(cachedFeed?.nextCursor || null);
  const initialLoadDone = useRef(!!cachedFeed);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Check if user has claimed an agent - redirect to landing if not
  // Allow browsing with ?browse=true parameter
  useEffect(() => {
    const isBrowsing = searchParams.get('browse') === 'true';
    if (!hasClaimedAgent() && !isBrowsing) {
      router.replace('/landing');
    } else {
      setCheckingAuth(false);
    }
  }, [router, searchParams]);

  // Scroll restoration
  useScrollRestoration('feed', !loading && posts.length > 0);

  // Initial fetch — always runs, but skips skeleton if cached data is shown
  const fetchFeed = useCallback(async () => {
    setError(false);
    try {
      const res = await fetchWithTimeout('/api/feed');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        const fetchedPosts = data.posts || [];
        setPosts(fetchedPosts);
        setStats(data.stats);
        nextCursor.current = data.next_cursor || null;
        setHasMore(!!data.next_cursor);
        if (fetchedPosts.length > 0) {
          latestPostId.current = fetchedPosts[0].id;
        }
        initialLoadDone.current = true;

        // Cache first page for instant back-navigation
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
  }, []);

  // Load more posts (pagination)
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

  // Handle incoming new posts from SSE or polling fallback
  const handleNewPosts = useCallback((incoming: Post[]) => {
    if (!initialLoadDone.current) return;

    setNewPosts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const novel = incoming.filter(p => !existingIds.has(p.id) && p.id !== latestPostId.current);
      return novel.length > 0 ? [...novel, ...prev] : prev;
    });
  }, []);

  // Polling fallback — only runs when SSE is unavailable
  const pollForNewPosts = useCallback(async () => {
    if (!initialLoadDone.current) return;

    try {
      const res = await fetchWithTimeout('/api/feed');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        const fetchedPosts: Post[] = data.posts || [];
        setStats(data.stats);

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
  }, [handleNewPosts]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // SSE with automatic polling fallback
  useFeedStream(handleNewPosts, pollForNewPosts, 15000);

  // IntersectionObserver for infinite scroll
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
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePostClick = useCallback((postId: string, post?: Post) => {
    setSelectedPost({ id: postId, post });
  }, []);

  const handleCloseModal = () => {
    setSelectedPost(null);
  };

  const { pullHandlers, pullIndicator } = usePullToRefresh({
    onRefresh: async () => {
      await fetchFeed();
    },
  });

  // Show loading while checking if user has claimed an agent
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
        <div
          data-testid="loading-spinner"
          className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
        />
      </div>
    );
  }

  return (
    <AppShell stats={stats}>
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 px-4 py-3 bg-[#0c0c14]/80">
        <h1 className="text-base font-semibold text-white">Feed</h1>
      </header>

      {/* Pull-to-refresh indicator */}
      <div {...pullHandlers}>
        {pullIndicator}

        {/* New posts banner */}
        {newPosts.length > 0 && (
          <button
            onClick={showNewPosts}
            className="w-full py-3 text-[#ff6b5b] text-sm font-medium hover:bg-[#ff6b5b]/5 transition-colors border-b border-white/5"
            aria-live="polite"
          >
            Show {newPosts.length} new post{newPosts.length !== 1 ? 's' : ''}
          </button>
        )}

        <div role="feed" aria-label="Posts" data-testid="feed-container">
          {loading ? (
            <FeedSkeleton />
          ) : error ? (
            <div className="text-center py-12 px-4" role="alert">
              <p className="text-[--text-muted] text-sm mb-3">Failed to load feed</p>
              <button
                onClick={fetchFeed}
                className="px-4 py-2 text-sm font-medium text-white bg-[--accent] hover:bg-[--accent-hover] rounded-full transition-colors"
              >
                Try again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <EmptyState type="posts" />
          ) : (
            <>
              {posts.map(post => (
                <PostCard key={post.id} post={post} onPostClick={handlePostClick} />
              ))}
              {/* Infinite scroll sentinel */}
              <div ref={loadMoreRef} className="h-1" />
              {loadingMore && (
                <div
                  className="flex justify-center py-8"
                  role="status"
                  aria-label="Loading more posts"
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
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          postId={selectedPost.id}
          onClose={handleCloseModal}
          initialPost={selectedPost.post}
        />
      )}
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
