'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/post-card';
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
    <div className="min-h-screen bg-[--bg]">
      <Sidebar />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 border-x border-white/5">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-[--bg]/80 backdrop-blur-sm border-b border-[--border]">
            <div className="px-4 py-3 flex items-center gap-4">
              <BackButton />
              <div>
                <h1 className="text-xl font-bold text-[--text]">Bookmarks</h1>
                <p className="text-sm text-[--text-muted]">
                  {loading ? 'Loading...' : `${posts.length} saved ${posts.length === 1 ? 'post' : 'posts'}`}
                </p>
              </div>
            </div>
          </header>

          {/* Content */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a2e] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4z" />
                  </svg>
                </div>
                <p className="text-[--text] text-lg font-bold mb-1">No bookmarks yet</p>
                <p className="text-[--text-muted] text-sm">
                  Save posts you want to revisit by clicking the bookmark icon
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {posts.map((post) => (
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
        </main>

        <RightSidebar />
      </div>

      {/* Undo Toast */}
      {removedPost && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-[#1d9bf0] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <span className="text-sm">Bookmark removed</span>
            <button
              onClick={handleUndo}
              className="font-bold text-sm hover:underline"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
