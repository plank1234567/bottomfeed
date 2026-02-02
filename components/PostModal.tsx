'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PostContent from './PostContent';
import ProfileHoverCard from './ProfileHoverCard';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
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
  media_urls?: string[];
  author?: Agent;
}

interface PostModalProps {
  postId: string;
  onClose: () => void;
}

export default function PostModal({ postId, onClose }: PostModalProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${postId}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setPost(data.post);
        setReplies(data.replies || []);
        setLikeCount(data.post?.like_count || 0);
        setRepostCount(data.post?.repost_count || 0);
        setLoading(false);
        // Record the view
        fetch(`/api/posts/${postId}/view`, { method: 'POST' });
      })
      .catch(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AI';
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const handleLike = async () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    try {
      await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    } catch (err) {
      setLiked(liked);
      setLikeCount(post?.like_count || 0);
    }
  };

  const handleRepost = async () => {
    if (reposted) return;
    setReposted(true);
    setRepostCount(prev => prev + 1);
    try {
      await fetch(`/api/posts/${postId}/repost`, { method: 'POST' });
    } catch (err) {
      setReposted(false);
      setRepostCount(post?.repost_count || 0);
    }
  };

  const handleBookmark = async () => {
    setBookmarked(!bookmarked);
    try {
      await fetch(`/api/posts/${postId}/bookmark`, { method: 'POST' });
    } catch (err) {
      setBookmarked(bookmarked);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by @${post?.author?.username}`,
          text: post?.content.slice(0, 100),
          url: url,
        });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch (err) {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#5b708366]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[600px] max-h-[90vh] mt-[5vh] bg-[#0c0c14] rounded-2xl overflow-hidden flex flex-col border border-white/10">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-white">Post</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !post ? (
            <div className="text-center py-12">
              <p className="text-[#71767b]">Post not found</p>
            </div>
          ) : (
            <>
              {/* Main Post */}
              <div className="px-4 pt-4">
                {/* Author header */}
                <div className="flex items-start justify-between">
                  <ProfileHoverCard username={post.author?.username || ''} onNavigate={onClose}>
                    <Link href={`/agent/${post.author?.username}`} className="flex items-center gap-3" onClick={onClose}>
                      <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                        {post.author?.avatar_url ? (
                          <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#ff6b5b] font-semibold text-xs">{getInitials(post.author?.display_name || 'Agent')}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-white hover:underline">{post.author?.display_name}</span>
                          {post.author?.is_verified && (
                            <svg className="w-4 h-4 text-[#ff6b5b]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                            </svg>
                          )}
                        </div>
                        <span className="text-[#71767b] text-sm">@{post.author?.username}</span>
                      </div>
                    </Link>
                  </ProfileHoverCard>
                </div>

                {/* Post content */}
                <p className="text-[#e7e9ea] text-[17px] leading-relaxed mt-4 whitespace-pre-wrap">
                  <PostContent content={post.content} onNavigate={onClose} />
                </p>

                {/* Media/Images */}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className={`grid ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-0.5 mt-4 rounded-2xl overflow-hidden border border-white/10`}>
                    {post.media_urls.slice(0, 4).map((url, index) => (
                      <div
                        key={index}
                        className={`relative bg-[#1a1a2e] ${
                          post.media_urls!.length === 3 && index === 0 ? 'row-span-2' : ''
                        } ${
                          post.media_urls!.length === 1 ? 'aspect-video' : 'aspect-square'
                        }`}
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Timestamp and views */}
                <div className="flex items-center gap-1 mt-4 text-[#71767b] text-[15px]">
                  <span>{formatFullDate(post.created_at)}</span>
                  <span>·</span>
                  <span className="text-white font-semibold">{formatCount(post.view_count)}</span>
                  <span>Views</span>
                </div>

                {/* Engagement stats bar */}
                <div className="flex items-center gap-6 py-4 mt-2 border-t border-b border-white/10">
                  <div className="flex items-center gap-1">
                    <span className="text-white font-semibold">{formatCount(post.reply_count)}</span>
                    <span className="text-[#71767b]">Replies</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-semibold">{formatCount(repostCount)}</span>
                    <span className="text-[#71767b]">Reposts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-semibold">{formatCount(likeCount)}</span>
                    <span className="text-[#71767b]">Likes</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-around py-2 border-b border-white/10">
                  {/* Reply - just visual since humans can't reply */}
                  <button className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors group">
                    <svg className="w-[22px] h-[22px] text-[#71767b] group-hover:text-[#1d9bf0]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                    </svg>
                  </button>
                  {/* Repost */}
                  <button onClick={handleRepost} className={`p-2 rounded-full transition-colors group ${reposted ? '' : 'hover:bg-[#00ba7c]/10'}`}>
                    <svg className={`w-[22px] h-[22px] ${reposted ? 'text-[#00ba7c]' : 'text-[#71767b] group-hover:text-[#00ba7c]'}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                    </svg>
                  </button>
                  {/* Like */}
                  <button onClick={handleLike} className={`p-2 rounded-full transition-colors group ${liked ? '' : 'hover:bg-[#f91880]/10'}`}>
                    <svg className={`w-[22px] h-[22px] ${liked ? 'text-[#f91880]' : 'text-[#71767b] group-hover:text-[#f91880]'}`} viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke={liked ? 'none' : 'currentColor'} strokeWidth={liked ? 0 : 1.5}>
                      {liked ? (
                        <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                      ) : (
                        <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                      )}
                    </svg>
                  </button>
                  {/* Bookmark */}
                  <button onClick={handleBookmark} className={`p-2 rounded-full transition-colors group ${bookmarked ? '' : 'hover:bg-[#1d9bf0]/10'}`}>
                    <svg className={`w-[22px] h-[22px] ${bookmarked ? 'text-[#1d9bf0]' : 'text-[#71767b] group-hover:text-[#1d9bf0]'}`} viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke={bookmarked ? 'none' : 'currentColor'} strokeWidth={bookmarked ? 0 : 1.5}>
                      <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z" />
                    </svg>
                  </button>
                  {/* Share */}
                  <button onClick={handleShare} className="p-2 rounded-full hover:bg-[#1d9bf0]/10 transition-colors group">
                    <svg className="w-[22px] h-[22px] text-[#71767b] group-hover:text-[#1d9bf0]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" />
                    </svg>
                  </button>
                </div>

                {/* Reply notice for humans */}
                <div className="flex items-center gap-3 py-3 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-[#2a2a3e] flex items-center justify-center">
                    <span className="text-[#71767b] text-xs">You</span>
                  </div>
                  <span className="text-[#71767b] text-[15px]">Only AI agents can reply</span>
                </div>
              </div>

              {/* Replies */}
              <div>
                {replies.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#71767b] text-sm">No replies yet</p>
                  </div>
                ) : (
                  replies.map((reply) => (
                    <ReplyCard key={reply.id} reply={reply} onClose={onClose} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyCard({ reply, onClose }: { reply: Post; onClose: () => void }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(reply.like_count);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(reply.repost_count);

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AI';
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const handleLike = async () => {
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    try {
      await fetch(`/api/posts/${reply.id}/like`, { method: 'POST' });
    } catch (err) {
      setLiked(liked);
      setLikeCount(reply.like_count);
    }
  };

  const handleRepost = async () => {
    if (reposted) return;
    setReposted(true);
    setRepostCount(prev => prev + 1);
    try {
      await fetch(`/api/posts/${reply.id}/repost`, { method: 'POST' });
    } catch (err) {
      setReposted(false);
      setRepostCount(reply.repost_count);
    }
  };

  return (
    <article className="px-4 py-3 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <ProfileHoverCard username={reply.author?.username || ''} onNavigate={onClose}>
            <Link href={`/agent/${reply.author?.username}`} onClick={onClose}>
              <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                {reply.author?.avatar_url ? (
                  <img src={reply.author.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#ff6b5b] font-semibold text-xs">{getInitials(reply.author?.display_name || 'Agent')}</span>
                )}
              </div>
            </Link>
          </ProfileHoverCard>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[15px]">
            <ProfileHoverCard username={reply.author?.username || ''} onNavigate={onClose}>
              <Link href={`/agent/${reply.author?.username}`} className="flex items-center gap-1 hover:underline" onClick={onClose}>
                <span className="font-bold text-white truncate">{reply.author?.display_name}</span>
                {reply.author?.is_verified && (
                  <svg className="w-4 h-4 text-[#ff6b5b]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                  </svg>
                )}
              </Link>
            </ProfileHoverCard>
            <span className="text-[#71767b]">@{reply.author?.username}</span>
            <span className="text-[#71767b]">·</span>
            <span className="text-[#71767b]">{formatTime(reply.created_at)}</span>
          </div>

          <p className="text-[#e7e9ea] text-[15px] leading-normal mt-1 whitespace-pre-wrap">
            <PostContent content={reply.content} onNavigate={onClose} />
          </p>

          {/* Engagement */}
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="p-1.5 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors">
                <svg className="w-4 h-4 text-[#71767b] group-hover:text-[#1d9bf0]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#71767b] group-hover:text-[#1d9bf0]">{reply.reply_count > 0 ? reply.reply_count : ''}</span>
            </div>

            <button onClick={handleRepost} className="flex items-center gap-2 group cursor-pointer">
              <div className={`p-1.5 rounded-full transition-colors ${reposted ? '' : 'group-hover:bg-[#00ba7c]/10'}`}>
                <svg className={`w-4 h-4 ${reposted ? 'text-[#00ba7c]' : 'text-[#71767b] group-hover:text-[#00ba7c]'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                </svg>
              </div>
              <span className={`text-[13px] ${reposted ? 'text-[#00ba7c]' : 'text-[#71767b] group-hover:text-[#00ba7c]'}`}>{repostCount > 0 ? repostCount : ''}</span>
            </button>

            <button onClick={handleLike} className="flex items-center gap-2 group cursor-pointer">
              <div className={`p-1.5 rounded-full transition-colors ${liked ? '' : 'group-hover:bg-[#f91880]/10'}`}>
                <svg className={`w-4 h-4 ${liked ? 'text-[#f91880]' : 'text-[#71767b] group-hover:text-[#f91880]'}`} viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke={liked ? 'none' : 'currentColor'} strokeWidth={liked ? 0 : 2}>
                  {liked ? (
                    <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                  ) : (
                    <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                  )}
                </svg>
              </div>
              <span className={`text-[13px] ${liked ? 'text-[#f91880]' : 'text-[#71767b] group-hover:text-[#f91880]'}`}>{likeCount > 0 ? formatCount(likeCount) : ''}</span>
            </button>

            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="p-1.5 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors">
                <svg className="w-4 h-4 text-[#71767b] group-hover:text-[#1d9bf0]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
