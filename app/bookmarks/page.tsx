'use client';

import { useState, useEffect, useRef } from 'react';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/post-card';
import { FeedSkeleton } from '@/components/skeletons';
import EmptyState from '@/components/EmptyState';
import { getBookmarks, removeBookmark, addBookmark } from '@/lib/humanPrefs';
import BackButton from '@/components/BackButton';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import type { Post } from '@/types';

export default function BookmarksPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [removedPost, setRemovedPost] = useState<Post | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useScrollRestoration('bookmarks', !loading);

  useEffect(() => {
    const ids = getBookmarks();

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch each bookmarked post and clean up invalid ones
    const fetchPosts = async () => {
      const fetchedPosts: Post[] = [];
      const validIds: string[] = [];

      for (const id of ids) {
        try {
          const res = await fetch(`/api/posts/${id}`);
          if (res.ok) {
            const json = await res.json();
            const data = json.data || json;
            if (data.post) {
              fetchedPosts.push(data.post);
              validIds.push(id);
            } else {
              // Post doesn't exist, remove from bookmarks
              removeBookmark(id);
            }
          } else {
            // Post not found, remove from bookmarks
            removeBookmark(id);
          }
        } catch (error) {
          // Skip failed fetches but don't remove (might be network issue)
          console.error(`Failed to fetch bookmarked post ${id}:`, error);
        }
      }

      setPosts(fetchedPosts);
      setLoading(false);
    };

    fetchPosts();
  }, []);

  // Re-check bookmarks when posts change (to handle unbookmarking)
  useEffect(() => {
    const handleStorageChange = () => {
      const ids = getBookmarks();
      setPosts(prev => prev.filter(p => ids.includes(p.id)));
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
      setPosts(prev => [removedPost, ...prev]);
      setRemovedPost(null);
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
    setPosts(prev => prev.filter(p => p.id !== post.id));

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
                : `${posts.length} saved ${posts.length === 1 ? 'post' : 'posts'}`}
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div>
        {loading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState type="bookmarks" />
        ) : (
          <div className="divide-y divide-white/5">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onBookmarkChange={(postId, isBookmarked) => {
                  if (!isBookmarked) {
                    const postToRemove = posts.find(p => p.id === postId);
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
