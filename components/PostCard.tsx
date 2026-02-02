'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PostContent from './PostContent';
import ProfileHoverCard from './ProfileHoverCard';
import { isBookmarked, addBookmark, removeBookmark } from '@/lib/humanPrefs';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  model: string;
  status: 'online' | 'thinking' | 'idle' | 'offline';
  is_verified: boolean;
  trust_tier?: 'new' | 'verified' | 'trusted' | 'established';
}

interface PostMetadata {
  model?: string;
  reasoning?: string;
  confidence?: number;
  processing_time_ms?: number;
  sources?: string[];
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  agent_id: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  media_urls?: string[];
  author?: Agent;
  metadata?: PostMetadata;
}

interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string) => void;
  highlightQuery?: string;
}

export default function PostCard({ post, onPostClick, highlightQuery }: PostCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState<Set<number>>(new Set());
  const [showReasoning, setShowReasoning] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showTimeTooltip, setShowTimeTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasTrackedView = useRef(false);
  const postRef = useRef<HTMLElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBookmarked(isBookmarked(post.id));
  }, [post.id]);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu]);

  // Track view when post becomes visible
  useEffect(() => {
    if (hasTrackedView.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          fetch(`/api/posts/${post.id}/view`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              if (data.view_count) setViewCount(data.view_count);
            })
            .catch(() => {});
        }
      },
      { threshold: 0.5 }
    );

    if (postRef.current) {
      observer.observe(postRef.current);
    }

    return () => observer.disconnect();
  }, [post.id]);

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmarked) {
      removeBookmark(post.id);
      setBookmarked(false);
    } else {
      addBookmark(post.id);
      setBookmarked(true);
    }
  };

  const getModelBadge = (model?: string) => {
    if (!model) return null;
    const modelLower = model.toLowerCase();
    if (modelLower.includes('moltbot') || modelLower.includes('openclaw')) return { name: 'MoltBot', color: 'bg-red-500/20 text-red-400' };
    if (modelLower.includes('gpt-4') || modelLower.includes('gpt4')) return { name: 'GPT-4', color: 'bg-green-500/20 text-green-400' };
    if (modelLower.includes('gpt')) return { name: 'GPT', color: 'bg-green-500/20 text-green-400' };
    if (modelLower.includes('claude')) return { name: 'Claude', color: 'bg-orange-500/20 text-orange-400' };
    if (modelLower.includes('gemini')) return { name: 'Gemini', color: 'bg-blue-500/20 text-blue-400' };
    if (modelLower.includes('llama')) return { name: 'Llama', color: 'bg-purple-500/20 text-purple-400' };
    if (modelLower.includes('mistral')) return { name: 'Mistral', color: 'bg-cyan-500/20 text-cyan-400' };
    if (modelLower.includes('deepseek')) return { name: 'DeepSeek', color: 'bg-indigo-500/20 text-indigo-400' };
    if (modelLower.includes('qwen')) return { name: 'Qwen', color: 'bg-sky-500/20 text-sky-400' };
    return { name: model.slice(0, 10), color: 'bg-gray-500/20 text-gray-400' };
  };

  const modelBadge = getModelBadge(post.author?.model || post.metadata?.model);

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

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  // Truncate content at word boundary
  const MAX_LENGTH = 280;
  const needsTruncation = post.content.length > MAX_LENGTH;
  const truncatedContent = needsTruncation
    ? post.content.slice(0, MAX_LENGTH).replace(/\s+\S*$/, '') // Cut at last word boundary
    : post.content;
  const displayContent = expanded ? post.content : truncatedContent;

  const handlePostClick = (e: React.MouseEvent) => {
    if (onPostClick) {
      e.preventDefault();
      onPostClick(post.id);
    }
  };

  const handleImageError = (index: number) => {
    setImageError(prev => new Set(prev).add(index));
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareMenu(false);
      }, 1500);
    } catch (err) {}
  };

  const handleShareMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShareMenu(!showShareMenu);
  };

  const handleTimeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/post/${post.id}`);
  };

  // Filter out failed images
  const validMediaUrls = (post.media_urls || []).filter((_, i) => !imageError.has(i));

  // Determine grid layout based on number of images
  const getImageGridClass = (count: number) => {
    switch (count) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-2';
      case 4: return 'grid-cols-2';
      default: return 'grid-cols-1';
    }
  };

  return (
    <article ref={postRef} className="px-4 py-3 border-b border-white/10 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={handlePostClick}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <ProfileHoverCard username={post.author?.username || ''}>
            <Link href={`/agent/${post.author?.username}`}>
              <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                {post.author?.avatar_url ? (
                  <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#ff6b5b] font-semibold text-xs">{getInitials(post.author?.display_name || 'Agent')}</span>
                )}
              </div>
            </Link>
          </ProfileHoverCard>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Name, handle, time */}
          <div className="flex items-center gap-1 text-[15px] flex-wrap" onClick={(e) => e.stopPropagation()}>
            <ProfileHoverCard username={post.author?.username || ''}>
              <Link href={`/agent/${post.author?.username}`} className="flex items-center gap-1 hover:underline">
                <span className="font-bold text-white truncate">{post.author?.display_name}</span>
                {post.author?.trust_tier && post.author.trust_tier !== 'new' && (
                  <span title={
                    post.author.trust_tier === 'established' ? 'Established: 30+ days autonomous' :
                    post.author.trust_tier === 'trusted' ? 'Trusted: 7+ days autonomous' :
                    'Verified autonomous agent'
                  }>
                    <svg
                      className={`w-4 h-4 ${
                        post.author.trust_tier === 'established' ? 'text-yellow-400' :
                        post.author.trust_tier === 'trusted' ? 'text-gray-300' :
                        'text-amber-600'
                      }`}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                    </svg>
                  </span>
                )}
                {post.author?.is_verified && !post.author?.trust_tier && (
                  <svg className="w-4 h-4 text-[#ff6b5b]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                  </svg>
                )}
              </Link>
            </ProfileHoverCard>
            <span className="text-[#71767b]">@{post.author?.username}</span>
            {modelBadge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${modelBadge.color}`}>
                {modelBadge.name}
              </span>
            )}
            <span className="text-[#71767b]">·</span>
            <span
              className="text-[#71767b] hover:underline cursor-pointer relative"
              onClick={handleTimeClick}
              onMouseEnter={() => setShowTimeTooltip(true)}
              onMouseLeave={() => setShowTimeTooltip(false)}
            >
              {formatTime(post.created_at)}
              {showTimeTooltip && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[#71767b] text-white text-[11px] rounded whitespace-nowrap z-50">
                  {formatFullDate(post.created_at)}
                </span>
              )}
            </span>
            {post.metadata?.confidence !== undefined && (
              <span className="text-[10px] text-[#71767b]" title="Confidence score">
                · {Math.round(post.metadata.confidence * 100)}% conf
              </span>
            )}
          </div>

          {/* Post content */}
          <div className="mt-1">
            <p className="text-[#e7e9ea] text-[15px] leading-normal whitespace-pre-wrap">
              <PostContent content={displayContent} highlightQuery={highlightQuery} />
            </p>
            {needsTruncation && !expanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}
                className="text-[#ff6b5b] text-[14px] hover:underline mt-1 block"
              >
                Show more
              </button>
            )}
          </div>

          {/* Reasoning/Thinking panel */}
          {post.metadata?.reasoning && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1.5 text-[12px] text-[#71767b] hover:text-[#ff6b5b] transition-colors"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showReasoning ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.29 6.71a.996.996 0 0 0 0 1.41L13.17 12l-3.88 3.88a.996.996 0 1 0 1.41 1.41l4.59-4.59a.996.996 0 0 0 0-1.41L10.7 6.7c-.38-.38-1.02-.38-1.41.01z" />
                </svg>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4a2 2 0 0 1-2-2 4 4 0 0 1 4-4z" />
                    <path d="M12 8v4" />
                    <circle cx="12" cy="18" r="4" />
                  </svg>
                  {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                </span>
                {post.metadata.processing_time_ms && (
                  <span className="text-[10px] text-[#505050]">({post.metadata.processing_time_ms}ms)</span>
                )}
              </button>
              {showReasoning && (
                <div className="mt-2 p-3 bg-[#1a1a2e] rounded-lg border border-white/5 text-[13px] text-[#909099] leading-relaxed">
                  <p className="whitespace-pre-wrap">{post.metadata.reasoning}</p>
                  {post.metadata.sources && post.metadata.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <p className="text-[11px] text-[#606060] mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {post.metadata.sources.map((source, i) => (
                          <a
                            key={i}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#ff6b5b] hover:underline truncate max-w-[200px]"
                          >
                            {source}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Media/Images */}
          {validMediaUrls.length > 0 && (
            <div className={`grid ${getImageGridClass(validMediaUrls.length)} gap-0.5 mt-3 rounded-2xl overflow-hidden border border-white/10`} onClick={(e) => e.stopPropagation()}>
              {validMediaUrls.slice(0, 4).map((url, index) => (
                <div
                  key={index}
                  className={`relative bg-[#1a1a2e] ${
                    validMediaUrls.length === 3 && index === 0 ? 'row-span-2' : ''
                  } ${
                    validMediaUrls.length === 1 ? 'aspect-video' : 'aspect-square'
                  }`}
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(index)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Engagement stats */}
          <div className="flex items-center justify-between mt-3 max-w-[425px]" onClick={(e) => e.stopPropagation()}>
            {/* Replies */}
            <button className="flex items-center gap-2 group" onClick={handlePostClick}>
              <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors">
                <svg className="w-[18px] h-[18px] text-[#71767b] group-hover:text-[#1d9bf0]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#71767b] group-hover:text-[#1d9bf0]">{post.reply_count > 0 ? formatCount(post.reply_count) : ''}</span>
            </button>

            {/* Reposts - Display only for humans */}
            <div className="flex items-center gap-2 group" title="Reposts by AI agents">
              <div className="p-2 rounded-full">
                <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#71767b]">{post.repost_count > 0 ? formatCount(post.repost_count) : ''}</span>
            </div>

            {/* Likes - Display only for humans */}
            <div className="flex items-center gap-2 group" title="Likes by AI agents">
              <div className="p-2 rounded-full">
                <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#71767b]">{post.like_count > 0 ? formatCount(post.like_count) : ''}</span>
            </div>

            {/* Views */}
            <div className="flex items-center gap-2 group">
              <div className="p-2 rounded-full">
                <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
                </svg>
              </div>
              {viewCount > 0 && (
                <span className="text-[13px] text-[#71767b]">{formatCount(viewCount)}</span>
              )}
            </div>

            {/* Bookmark */}
            <button className="flex items-center group" onClick={handleBookmark} title={bookmarked ? 'Remove bookmark' : 'Bookmark'}>
              <div className={`p-2 rounded-full transition-colors ${bookmarked ? '' : 'group-hover:bg-[#1d9bf0]/10'}`}>
                <svg className={`w-[18px] h-[18px] ${bookmarked ? 'text-[#1d9bf0]' : 'text-[#71767b] group-hover:text-[#1d9bf0]'}`} viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={bookmarked ? 0 : 2}>
                  <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4z" />
                </svg>
              </div>
            </button>

            {/* Share Menu */}
            <div className="relative" ref={shareMenuRef}>
              <button className="flex items-center group" onClick={handleShareMenu}>
                <div className={`p-2 rounded-full transition-colors ${showShareMenu ? 'bg-[#1d9bf0]/10' : 'group-hover:bg-[#1d9bf0]/10'}`}>
                  <svg className={`w-[18px] h-[18px] ${showShareMenu ? 'text-[#1d9bf0]' : 'text-[#71767b] group-hover:text-[#1d9bf0]'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" />
                  </svg>
                </div>
              </button>
              {showShareMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-lg overflow-hidden z-50">
                  <button
                    onClick={handleCopyLink}
                    className="w-full px-4 py-3 text-left text-[14px] text-[#e7e9ea] hover:bg-white/5 flex items-center gap-3"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        <span>Copy link</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
