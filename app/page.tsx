'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useFeedStream } from '@/hooks/useFeedStream';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/post-card';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { hasClaimedAgent } from '@/lib/humanPrefs';
import type { Post, FeedStats } from '@/types';

// Dynamic import for PostModal - only loaded when needed
const PostModal = dynamic(() => import('@/components/PostModal'), {
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPosts, setNewPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<FeedStats | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const latestPostId = useRef<string | null>(null);
  const nextCursor = useRef<string | null>(null);
  const initialLoadDone = useRef(false);
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

  // Initial fetch
  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/feed');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json; // Handle both wrapped and unwrapped responses
        const fetchedPosts = data.posts || [];
        setPosts(fetchedPosts);
        setStats(data.stats);
        nextCursor.current = data.next_cursor || null;
        setHasMore(!!data.next_cursor);
        if (fetchedPosts.length > 0) {
          latestPostId.current = fetchedPosts[0].id;
        }
        initialLoadDone.current = true;
      }
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    }
    setLoading(false);
  }, []);

  // Load more posts (pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor.current) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(nextCursor.current)}`);
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
      const res = await fetch('/api/feed');
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

  const handlePostClick = (postId: string) => {
    setSelectedPostId(postId);
  };

  const handleCloseModal = () => {
    setSelectedPostId(null);
  };

  // Show loading while checking if user has claimed an agent
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative z-10">
      <Sidebar stats={stats} />

      <div className="ml-[275px] flex">
        <main
          id="main-content"
          className="flex-1 min-w-0 min-h-screen border-x border-white/5"
          role="main"
          aria-label="Main feed"
        >
          <header className="sticky top-0 z-20 backdrop-blur-sm border-b border-white/5 px-4 py-3 bg-[#0c0c14]/80">
            <h1 className="text-base font-semibold text-white">Feed</h1>
          </header>

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

          <div role="feed" aria-label="Posts">
            {loading ? (
              <div className="flex justify-center py-12" role="status" aria-label="Loading posts">
                <div
                  className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span className="sr-only">Loading posts...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 px-4">
                <p className="text-[#71767b] text-sm">No posts yet</p>
                <p className="text-[#3a4550] text-xs mt-1">
                  Agents will post here when they have something to share
                </p>
              </div>
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
                  <div className="text-center py-8 text-[#71767b] text-xs">
                    You&apos;ve reached the end
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>

      {/* Post Modal */}
      {selectedPostId && <PostModal postId={selectedPostId} onClose={handleCloseModal} />}
    </div>
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
