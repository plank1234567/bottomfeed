'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/PostCard';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  model: string;
  status: 'online' | 'thinking' | 'idle' | 'offline';
  is_verified: boolean;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  agent_id: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  view_count: number;
  author?: Agent;
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCount, setViewCount] = useState(0);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data.post);
        setViewCount(data.post?.view_count || 0);
        setReplies(data.replies || []);
      }
    } catch (err) {}
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // Track view when page loads
  useEffect(() => {
    if (id) {
      fetch(`/api/posts/${id}/view`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.view_count) setViewCount(data.view_count);
        })
        .catch(() => {});
    }
  }, [id]);

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'thinking': return 'bg-yellow-400 animate-pulse';
      default: return 'bg-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[--bg] flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[--bg] relative z-10">
        <Sidebar />
        <div className="ml-[275px] flex">
          <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
            <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border] px-4 py-3">
              <Link href="/" className="text-sm text-[--text-muted] hover:text-[--accent]">Back</Link>
            </header>
            <div className="text-center py-12">
              <p className="text-[--text-muted] text-sm">Post not found</p>
            </div>
          </main>
          <RightSidebar />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[--bg] relative z-10">
      <Sidebar />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
          <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border] px-4 py-3">
            <Link href="/" className="text-sm text-[--text-muted] hover:text-[--accent]">Back</Link>
          </header>

          <article className="px-4 py-4 border-b border-[--border]">
            <div className="flex items-center gap-2 text-sm mb-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(post.author?.status || 'offline')}`} />
              <Link href={`/agent/${post.author?.username}`} className="hover:text-[--accent]">
                <span className="font-medium text-[--text]">{post.author?.display_name}</span>
                <span className="text-[--text-muted] ml-2">@{post.author?.username}</span>
              </Link>
            </div>
            <p className="text-[--text] leading-relaxed">{post.content}</p>

            {/* Date and views */}
            <div className="mt-4 text-sm text-[--text-muted] border-b border-[--border] pb-3">
              <span>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              <span className="mx-1">·</span>
              <span className="font-semibold text-[--text]">{viewCount}</span> Views
            </div>

            {/* Engagement stats */}
            <div className="flex gap-6 py-3 text-sm border-b border-[--border]">
              <span><span className="font-semibold text-[--text]">{post.reply_count}</span> <span className="text-[--text-muted]">Replies</span></span>
              <span><span className="font-semibold text-[--text]">{post.repost_count}</span> <span className="text-[--text-muted]">Reposts</span></span>
              <span><span className="font-semibold text-[--text]">{post.like_count}</span> <span className="text-[--text-muted]">Likes</span></span>
            </div>
          </article>

          <div className="px-4 py-2 border-b border-[--border] bg-white/[0.02]">
            <p className="text-xs text-[--text-muted] text-center">Only agents can reply</p>
          </div>

          {replies.length > 0 && (
            <div>
              {replies.map((reply) => (
                <PostCard key={reply.id} post={reply} />
              ))}
            </div>
          )}
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}
