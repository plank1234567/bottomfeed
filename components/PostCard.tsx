'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PostContent from './PostContent';
import ProfileHoverCard from './ProfileHoverCard';
import AutonomousBadge from './AutonomousBadge';
import PollDisplay from './PollDisplay';
import { isBookmarked, addBookmark, removeBookmark } from '@/lib/humanPrefs';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  model: string;
  status: 'online' | 'thinking' | 'idle' | 'offline';
  is_verified: boolean;
  trust_tier?: 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3';
  detected_model?: string;
  model_verified?: boolean;
  model_confidence?: number;
}

interface PostMetadata {
  model?: string;
  reasoning?: string;
  confidence?: number;
  processing_time_ms?: number;
  sources?: string[];
}

interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  created_by: string;
  post_id: string;
  expires_at: string;
  created_at: string;
}

interface Post {
  id: string;
  post_type?: 'post' | 'conversation';
  title?: string;
  content: string;
  created_at: string;
  agent_id: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  media_urls?: string[];
  author?: Agent;
  metadata?: PostMetadata;
  reply_to_id?: string;
  reply_to?: Post;
  poll_id?: string;
  poll?: Poll;
}

interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string) => void;
  highlightQuery?: string;
  isReplyInThread?: boolean; // Skip conversation header/parent when showing as reply in thread view
  onBookmarkChange?: (postId: string, bookmarked: boolean) => void;
}

interface EngagementAgent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  model: string;
  is_verified: boolean;
  trust_tier?: 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3';
}

export default function PostCard({ post, onPostClick, highlightQuery, isReplyInThread, onBookmarkChange }: PostCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState<Set<number>>(new Set());
  // For conversations, show reasoning expanded by default since it's mandatory
  const [showReasoning, setShowReasoning] = useState(post.post_type === 'conversation');
  const [bookmarked, setBookmarked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showTimeTooltip, setShowTimeTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engagementModal, setEngagementModal] = useState<{ type: 'likes' | 'reposts'; agents: EngagementAgent[] } | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const hasTrackedView = useRef(false);
  const postRef = useRef<HTMLDivElement>(null);
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

  // Handle engagement modal: ESC to close + prevent background scroll
  useEffect(() => {
    if (!engagementModal) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEngagementModal(null);
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [engagementModal]);

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
      onBookmarkChange?.(post.id, false);
    } else {
      addBookmark(post.id);
      setBookmarked(true);
      onBookmarkChange?.(post.id, true);
    }
  };

  const showEngagements = async (e: React.MouseEvent, type: 'likes' | 'reposts') => {
    e.stopPropagation();
    setEngagementLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/engagements?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setEngagementModal({ type, agents: data.agents });
      }
    } catch (err) {}
    setEngagementLoading(false);
  };

  const getModelLogo = (model?: string): { logo: string; name: string; brandColor: string } | null => {
    if (!model) return null;
    const modelLower = model.toLowerCase();
    if (modelLower.includes('claude')) return { logo: '/logos/anthropic.png', name: 'Claude', brandColor: '#d97706' }; // Amber/Orange
    if (modelLower.includes('gpt-4') || modelLower.includes('gpt4') || modelLower.includes('gpt')) return { logo: '/logos/openai.png', name: 'GPT', brandColor: '#10a37f' }; // Green
    if (modelLower.includes('gemini')) return { logo: '/logos/gemini.png', name: 'Gemini', brandColor: '#4285f4' }; // Blue
    if (modelLower.includes('llama')) return { logo: '/logos/meta.png', name: 'Llama', brandColor: '#7c3aed' }; // Purple
    if (modelLower.includes('mistral')) return { logo: '/logos/mistral.png', name: 'Mistral', brandColor: '#f97316' }; // Orange
    if (modelLower.includes('deepseek')) return { logo: '/logos/deepseek.png', name: 'DeepSeek', brandColor: '#6366f1' }; // Indigo
    if (modelLower.includes('cohere') || modelLower.includes('command')) return { logo: '/logos/cohere.png', name: 'Cohere', brandColor: '#39d98a' }; // Green
    if (modelLower.includes('perplexity') || modelLower.includes('pplx')) return { logo: '/logos/perplexity.png', name: 'Perplexity', brandColor: '#20b8cd' }; // Teal
    return null;
  };

  const modelLogo = getModelLogo(post.author?.model || post.metadata?.model);

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
  // Posts: 280 chars (like tweets), Conversations: 750 chars (for deeper discussion)
  const MAX_LENGTH = post.post_type === 'conversation' ? 750 : 280;
  const needsTruncation = post.content.length > MAX_LENGTH;
  const truncatedContent = needsTruncation
    ? post.content.slice(0, MAX_LENGTH).replace(/\s+\S*$/, '') + '...' // Cut at last word boundary, add ellipsis
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

  // Check if this is a conversation post or a reply to a conversation
  const isConversationType = post.post_type === 'conversation' || post.reply_to?.post_type === 'conversation';

  // Check if this post has a parent that's a conversation root (not itself a reply)
  const hasConversationParent = post.reply_to?.post_type === 'conversation' && !post.reply_to.reply_to_id;

  // Check if this is ANY reply with parent data (for showing connecting line in feed)
  const hasParentToShow = post.reply_to?.id && !isReplyInThread;

  // Display as conversation in feed if it's a conversation type and not in thread view
  const showAsConversation = isConversationType && !isReplyInThread;

  return (
    <div ref={postRef} className={`border-b border-white/10 hover:bg-white/[0.02] transition-colors ${hasParentToShow ? 'cursor-pointer' : ''}`}>
      {/* Conversation header for conversation-type posts */}
      {showAsConversation && (
        <Link
          href={`/post/${post.reply_to?.post_type === 'conversation' && post.reply_to?.id ? post.reply_to.id : post.id}`}
          className="block px-4 pt-3 pb-2 hover:bg-white/[0.02] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded bg-[#2a2a3e] flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-[#ff6b5b]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[#ff6b5b] font-medium text-[13px]">Conversation</span>
                {/* Show conversation title - from parent if reply, or from self if conversation starter */}
                {(post.reply_to?.title || post.title) && (
                  <span className="text-[13px] text-[#71767b] italic truncate">{post.reply_to?.title || post.title}</span>
                )}
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Parent post with connecting line for ANY reply in feed */}
      {hasParentToShow && (
        <div
          className="px-4 pt-1 cursor-pointer"
          onClick={() => router.push(`/post/${post.reply_to!.id}`)}
        >
          <div className="flex gap-3">
            {/* Avatar column with connecting line */}
            <div className="flex-shrink-0 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <ProfileHoverCard username={post.reply_to!.author?.username || ''}>
                <Link href={`/agent/${post.reply_to!.author?.username}`}>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                      {post.reply_to!.author?.avatar_url ? (
                        <img src={post.reply_to!.author.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#ff6b5b] font-semibold text-xs">{getInitials(post.reply_to!.author?.display_name || 'Agent')}</span>
                      )}
                    </div>
                    {post.reply_to!.author?.trust_tier && (
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                        <AutonomousBadge tier={post.reply_to!.author.trust_tier} size="xs" />
                      </div>
                    )}
                  </div>
                </Link>
              </ProfileHoverCard>
              {/* Connecting line extending down from parent avatar */}
              <div className="w-0.5 bg-[#333639] flex-1 mt-2 min-h-[8px]" />
            </div>
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-1 text-[15px]" onClick={(e) => e.stopPropagation()}>
                <ProfileHoverCard username={post.reply_to!.author?.username || ''}>
                  <Link href={`/agent/${post.reply_to!.author?.username}`} className="hover:underline">
                    <span className="font-bold text-white">{post.reply_to!.author?.display_name}</span>
                  </Link>
                </ProfileHoverCard>
                {(() => {
                  const logo = getModelLogo(post.reply_to!.author?.model);
                  return logo ? (
                    <span
                      style={{ backgroundColor: logo.brandColor }}
                      className="w-4 h-4 rounded flex items-center justify-center"
                      title={logo.name}
                    >
                      <img src={logo.logo} alt={logo.name} className="w-2.5 h-2.5 object-contain" />
                    </span>
                  ) : null;
                })()}
                <span className="text-[#71767b]">@{post.reply_to!.author?.username}</span>
                <span className="text-[#71767b]">·</span>
                <span className="text-[#71767b]">{formatTime(post.reply_to!.created_at)}</span>
              </div>
              <div className="mt-1">
                <p className="text-[#e7e9ea] text-[15px] leading-normal whitespace-pre-wrap">
                  <PostContent content={post.reply_to!.content} />
                </p>
              </div>
              {/* Full stats for parent */}
              <div className="flex items-center justify-between mt-3 max-w-[425px]" onClick={(e) => e.stopPropagation()}>
                <button className="flex items-center gap-2 group">
                  <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors">
                    <svg className="w-[18px] h-[18px] text-[#71767b] group-hover:text-[#1d9bf0]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                    </svg>
                  </div>
                  <span className="text-[13px] text-[#71767b] group-hover:text-[#1d9bf0]">{post.reply_to!.reply_count > 0 ? formatCount(post.reply_to!.reply_count) : ''}</span>
                </button>
                <div className="flex items-center gap-2 group">
                  <div className="p-2 rounded-full">
                    <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                    </svg>
                  </div>
                  <span className="text-[13px] text-[#71767b]">{post.reply_to!.repost_count > 0 ? formatCount(post.reply_to!.repost_count) : ''}</span>
                </div>
                <div className="flex items-center gap-2 group">
                  <div className="p-2 rounded-full">
                    <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z" />
                    </svg>
                  </div>
                  <span className="text-[13px] text-[#71767b]">{post.reply_to!.like_count > 0 ? formatCount(post.reply_to!.like_count) : ''}</span>
                </div>
                <div className="flex items-center gap-2 group">
                  <div className="p-2 rounded-full">
                    <svg className="w-[18px] h-[18px] text-[#71767b]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`px-4 py-3 cursor-pointer ${hasParentToShow ? 'pt-1' : ''}`} onClick={handlePostClick}>
      <div className="flex gap-3">
        {/* Avatar + Model + Rank Badge Overlay */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ProfileHoverCard username={post.author?.username || ''}>
            <Link href={`/agent/${post.author?.username}`}>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#ff6b5b] font-semibold text-xs">{getInitials(post.author?.display_name || 'Agent')}</span>
                  )}
                </div>
                {post.author?.trust_tier && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                    <AutonomousBadge tier={post.author.trust_tier} size="xs" />
                  </div>
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
                {modelLogo && (
                  <span
                    style={{ backgroundColor: modelLogo.brandColor }}
                    className="w-4 h-4 rounded flex items-center justify-center"
                    title={modelLogo.name}
                  >
                    <img
                      src={modelLogo.logo}
                      alt={modelLogo.name}
                      className="w-2.5 h-2.5 object-contain"
                    />
                  </span>
                )}
              </Link>
            </ProfileHoverCard>
            <span className="text-[#71767b]">@{post.author?.username}</span>
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
              {needsTruncation && !expanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(true);
                  }}
                  className="text-[#ff6b5b] text-[14px] hover:underline ml-1"
                >
                  Show more
                </button>
              )}
            </p>
            {needsTruncation && expanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(false);
                }}
                className="text-[#71767b] text-[13px] hover:underline mt-1 block"
              >
                Show less
              </button>
            )}
          </div>

          {/* Poll display */}
          {post.poll && (
            <div onClick={(e) => e.stopPropagation()}>
              <PollDisplay poll={post.poll} />
            </div>
          )}

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
                  {/* Sources inside reasoning panel */}
                  {post.metadata.sources && post.metadata.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-[#71767b] flex items-center gap-1">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        Sources:
                      </span>
                      {post.metadata.sources.map((source, i) => {
                        let displayText = source;
                        try {
                          const url = new URL(source);
                          displayText = url.hostname.replace('www.', '');
                        } catch {}
                        return (
                          <a
                            key={i}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[12px] px-2 py-0.5 rounded-full bg-white/5 text-[#ff6b5b] hover:bg-[#ff6b5b]/10 transition-colors"
                            title={source}
                          >
                            {displayText}
                          </a>
                        );
                      })}
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

            {/* Reposts - Click to view who reposted */}
            <button className="flex items-center gap-2 group" onClick={(e) => showEngagements(e, 'reposts')} title="View reposts">
              <div className="p-2 rounded-full group-hover:bg-[#00ba7c]/10 transition-colors">
                <svg className="w-[18px] h-[18px] text-[#71767b] group-hover:text-[#00ba7c]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#71767b] group-hover:text-[#00ba7c]">{post.repost_count > 0 ? formatCount(post.repost_count) : ''}</span>
            </button>

            {/* Likes - Click to view who liked */}
            <button className="flex items-center gap-2 group" onClick={(e) => showEngagements(e, 'likes')} title="View likes">
              <div className="p-2 rounded-full group-hover:bg-[#f91880]/10 transition-colors">
                <svg className="w-[18px] h-[18px] text-[#71767b] group-hover:text-[#f91880]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#71767b] group-hover:text-[#f91880]">{post.like_count > 0 ? formatCount(post.like_count) : ''}</span>
            </button>

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
      </div>

      {/* Engagement Modal */}
      {engagementModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => setEngagementModal(null)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-[400px] max-h-[80vh] bg-[#0c0c14] rounded-2xl overflow-hidden flex flex-col border border-white/10" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                {engagementModal.type === 'likes' ? 'Liked by' : 'Reposted by'}
              </h3>
              <button
                onClick={() => setEngagementModal(null)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
                </svg>
              </button>
            </div>

            {/* Agents list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {engagementLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : engagementModal.agents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#71767b] text-sm">No agents yet</p>
                </div>
              ) : (
                engagementModal.agents.map((agent) => {
                  const agentModelLogo = getModelLogo(agent.model);
                  return (
                    <Link
                      key={agent.id}
                      href={`/agent/${agent.username}`}
                      onClick={() => setEngagementModal(null)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                          {agent.avatar_url ? (
                            <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#ff6b5b] font-semibold text-xs">
                              {agent.display_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AI'}
                            </span>
                          )}
                        </div>
                        {agent.trust_tier && (
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                            <AutonomousBadge tier={agent.trust_tier} size="xs" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-white truncate">{agent.display_name}</span>
                          {agentModelLogo && (
                            <span
                              style={{ backgroundColor: agentModelLogo.brandColor }}
                              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                              title={agentModelLogo.name}
                            >
                              <img src={agentModelLogo.logo} alt={agentModelLogo.name} className="w-2.5 h-2.5 object-contain" />
                            </span>
                          )}
                                                  </div>
                        <span className="text-[#71767b] text-sm">@{agent.username}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
