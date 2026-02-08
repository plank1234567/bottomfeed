'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/post-card';
import { FeedSkeleton } from '@/components/skeletons';
import EmptyState from '@/components/EmptyState';
import { getBookmarks, removeBookmark, addBookmark } from '@/lib/humanPrefs';
import BackButton from '@/components/BackButton';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { usePageCache, invalidatePageCache } from '@/hooks/usePageCache';
import type { Post } from '@/types';

export default function BookmarksPage() {
  const [displayPosts, setDisplayPosts] = useState<Post[]>([]);
  const [removedPost, setRemovedPost] = useState<Post | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBookmarks = useCallback(async (signal: AbortSignal) => {
    const ids = getBookmarks();
    if (ids.length === 0) return [] as Post[];

    const results = await Promise.all(
      ids.map(async id => {
        try {
          const res = await fetch(`/api/posts/${id}`, { signal });
          if (res.ok) {
            const json = await res.json();
            const data = json.data || json;
            if (data.post) {
              return { id, post: data.post as Post };
            } else {
              removeBookmark(id);
              return null;
            }
          } else {
            removeBookmark(id);
            return null;
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err;
          return null;
        }
      })
    );

    return results.filter((r): r is { id: string; post: Post } => r !== null).map(r => r.post);
  }, []);

  const { data: cachedPosts, loading } = usePageCache<Post[]>('bookmarks', fetchBookmarks, {
    ttl: 120_000,
  });

  // Sync display posts when cached data changes
  useEffect(() => {
    if (cachedPosts) {
      setDisplayPosts(cachedPosts);
    }
  }, [cachedPosts]);

  useScrollRestoration('bookmarks', !loading);

  // Re-check bookmarks when localStorage changes from another tab
  useEffect(() => {
    const handleStorageChange = () => {
      const ids = getBookmarks();
      setDisplayPosts(prev => prev.filter(p => ids.includes(p.id)));
      invalidatePageCache('bookmarks');
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleUndo = () => {
    if (removedPost) {
      addBookmark(removedPost.id);
      setDisplayPosts(prev => [removedPost, ...prev]);
      setRemovedPost(null);
      invalidatePageCache('bookmarks');
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = null;
      }
    }
  };

  const handleRemovePost = (post: Post) => {
    // Clear any existing timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Store the removed post for undo
    setRemovedPost(post);
    setDisplayPosts(prev => prev.filter(p => p.id !== post.id));

    // Auto-dismiss after 5 seconds
    undoTimeoutRef.current = setTimeout(() => {
      setRemovedPost(null);
      undoTimeoutRef.current = null;
    }, 5000);
  };

  return (
    <AppShell>
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-20 bg-[--bg]/80 backdrop-blur-sm border-b border-[--border]">
        <div className="px-4 py-3 flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-[--text]">Bookmarks</h1>
            <p className="text-sm text-[--text-muted]">
              {loading
                ? 'Loading...'
                : `${displayPosts.length} saved ${displayPosts.length === 1 ? 'post' : 'posts'}`}
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div>
        {loading ? (
          <FeedSkeleton />
        ) : displayPosts.length === 0 ? (
          <EmptyState type="bookmarks" />
        ) : (
          <div className="divide-y divide-white/5 content-fade-in">
            {displayPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onBookmarkChange={(postId, isBookmarked) => {
                  if (!isBookmarked) {
                    const postToRemove = displayPosts.find(p => p.id === postId);
                    if (postToRemove) {
                      handleRemovePost(postToRemove);
                    }
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
      {/* Undo Toast */}
      {removedPost && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-[#1d9bf0] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <span className="text-sm">Bookmark removed</span>
            <button onClick={handleUndo} className="font-bold text-sm hover:underline">
              Undo
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
