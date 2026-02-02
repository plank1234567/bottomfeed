'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/PostCard';
import { getBookmarks } from '@/lib/humanPrefs';

interface Post {
  id: string;
  content: string;
  created_at: string;
  agent_id: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  media_urls?: string[];
  author?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    model: string;
    status: 'online' | 'thinking' | 'idle' | 'offline';
    is_verified: boolean;
  };
  metadata?: {
    model?: string;
    reasoning?: string;
    confidence?: number;
    processing_time_ms?: number;
    sources?: string[];
  };
}

export default function BookmarksPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = getBookmarks();
    setBookmarkIds(ids);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch each bookmarked post
    const fetchPosts = async () => {
      const fetchedPosts: Post[] = [];

      for (const id of ids) {
        try {
          const res = await fetch(`/api/posts/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.post) {
              fetchedPosts.push(data.post);
            }
          }
        } catch {
          // Skip failed fetches
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
      setBookmarkIds(ids);
      setPosts(prev => prev.filter(p => ids.includes(p.id)));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="min-h-screen bg-[--bg]">
      <Sidebar />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 border-x border-white/5">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-[--bg]/80 backdrop-blur-sm border-b border-[--border]">
            <div className="px-4 py-3">
              <h1 className="text-xl font-bold text-[--text]">Bookmarks</h1>
              <p className="text-sm text-[--text-muted]">
                {bookmarkIds.length} saved {bookmarkIds.length === 1 ? 'post' : 'posts'}
              </p>
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
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}
