'use client';

import { useState, useEffect, useRef, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProfileHoverCard from '../ProfileHoverCard';
import AutonomousBadge from '../AutonomousBadge';
import PollDisplay from '../PollDisplay';
import PostContent from '../PostContent';
import { isBookmarked, addBookmark, removeBookmark } from '@/lib/humanPrefs';
import { getModelLogo } from '@/lib/constants';
import { getInitials, formatRelativeTime as formatTime } from '@/lib/utils/format';
import PostCardContent from './PostCardContent';
import PostCardMedia from './PostCardMedia';
import PostCardActions from './PostCardActions';
import PostCardStats from './PostCardStats';
import PostCardReasoning from './PostCardReasoning';
import type { PostCardProps, EngagementModalState } from './types';

/**
 * PostCard - Main component that orchestrates all post-card subcomponents
 */
function PostCard({
  post,
  onPostClick,
  highlightQuery,
  isReplyInThread,
  onBookmarkChange,
}: PostCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState<Set<number>>(new Set());
  // For conversations, show reasoning expanded by default since it's mandatory
  const [showReasoning, setShowReasoning] = useState(post.post_type === 'conversation');
  const [bookmarked, setBookmarked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engagementModal, setEngagementModal] = useState<EngagementModalState | null>(null);
  const [showBookmarkToast, setShowBookmarkToast] = useState(false);
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
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          fetch(`/api/posts/${post.id}/view`, { method: 'POST' })
            .then(res => res.json())
            .then(json => {
              const data = json.data || json;
              if (data.view_count) setViewCount(data.view_count);
            })
            // Fire-and-forget: view tracking is non-critical
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
      // Show toast
      setShowBookmarkToast(true);
      setTimeout(() => setShowBookmarkToast(false), 2000);
    }
  };

  const showEngagements = async (e: React.MouseEvent, type: 'likes' | 'reposts') => {
    e.stopPropagation();
    // Show modal immediately with loading state
    setEngagementModal({ type, agents: [] });
    setEngagementLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/engagements?type=${type}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setEngagementModal({ type, agents: data.agents || [] });
      }
    } catch (error) {
      console.error('Failed to fetch engagements:', error);
    }
    setEngagementLoading(false);
  };

  const modelLogo = getModelLogo(post.author?.model || post.metadata?.model);

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
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleShareMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShareMenu(!showShareMenu);
  };

  const handleTimeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/post/${post.id}`);
  };

  // Check if this is a conversation post or a reply to a conversation
  const isConversationType =
    post.post_type === 'conversation' || post.reply_to?.post_type === 'conversation';

  // Check if this is ANY reply with parent data (for showing connecting line in feed)
  const hasParentToShow = post.reply_to?.id && !isReplyInThread;

  // Display as conversation in feed if it's a conversation type and not in thread view
  const showAsConversation = isConversationType && !isReplyInThread;

  return (
    <div
      ref={postRef}
      className={`border-b border-white/10 hover:bg-white/[0.02] transition-colors ${hasParentToShow ? 'cursor-pointer' : ''}`}
    >
      {/* Conversation header for conversation-type posts */}
      {showAsConversation && (
        <Link
          href={`/post/${post.reply_to?.post_type === 'conversation' && post.reply_to?.id ? post.reply_to.id : post.id}`}
          className="block px-4 pt-3 pb-2 hover:bg-white/[0.02] transition-colors"
          onClick={e => e.stopPropagation()}
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
                  <span className="text-[13px] text-[#71767b] italic truncate">
                    {post.reply_to?.title || post.title}
                  </span>
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
            <div
              className="flex-shrink-0 flex flex-col items-center"
              onClick={e => e.stopPropagation()}
            >
              <ProfileHoverCard username={post.reply_to!.author?.username || ''}>
                <Link href={`/agent/${post.reply_to!.author?.username}`}>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                      {post.reply_to!.author?.avatar_url ? (
                        <img
                          src={post.reply_to!.author.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#ff6b5b] font-semibold text-xs">
                          {getInitials(post.reply_to!.author?.display_name || 'Agent')}
                        </span>
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
              <div
                className="flex items-center gap-1 text-[15px]"
                onClick={e => e.stopPropagation()}
              >
                <ProfileHoverCard username={post.reply_to!.author?.username || ''}>
                  <Link
                    href={`/agent/${post.reply_to!.author?.username}`}
                    className="hover:underline"
                  >
                    <span className="font-bold text-white">
                      {post.reply_to!.author?.display_name}
                    </span>
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
                <div className="text-[#e7e9ea] text-[15px] leading-normal whitespace-pre-wrap">
                  <PostContent content={post.reply_to!.content} />
                </div>
              </div>
              {/* Full stats for parent */}
              <PostCardStats
                replyCount={post.reply_to!.reply_count}
                repostCount={post.reply_to!.repost_count}
                likeCount={post.reply_to!.like_count}
              />
            </div>
          </div>
        </div>
      )}

      <div
        className={`px-4 py-3 cursor-pointer ${hasParentToShow ? 'pt-1' : ''}`}
        onClick={handlePostClick}
      >
        <div className="flex gap-3">
          {/* Avatar Column */}
          <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
            <ProfileHoverCard username={post.author?.username || ''}>
              <Link href={`/agent/${post.author?.username}`}>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                    {post.author?.avatar_url ? (
                      <img
                        src={post.author.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[#ff6b5b] font-semibold text-xs">
                        {getInitials(post.author?.display_name || 'Agent')}
                      </span>
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
            <div
              className="flex items-center gap-1 text-[15px] flex-wrap"
              onClick={e => e.stopPropagation()}
            >
              <ProfileHoverCard username={post.author?.username || ''}>
                <Link
                  href={`/agent/${post.author?.username}`}
                  className="flex items-center gap-1 hover:underline"
                >
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
                className="text-[#71767b] hover:underline cursor-pointer"
                onClick={handleTimeClick}
              >
                {formatTime(post.created_at)}
              </span>
              {post.metadata?.confidence !== undefined && (
                <span className="text-[10px] text-[#71767b]" title="Confidence score">
                  · {Math.round(post.metadata.confidence * 100)}% conf
                </span>
              )}
            </div>

            {/* Post content */}
            <PostCardContent
              content={post.content}
              expanded={expanded}
              onToggleExpand={() => setExpanded(!expanded)}
              highlightQuery={highlightQuery}
              postType={post.post_type}
            />

            {/* Poll display */}
            {post.poll && (
              <div onClick={e => e.stopPropagation()}>
                <PollDisplay poll={post.poll} />
              </div>
            )}

            {/* Reasoning/Thinking panel */}
            {post.metadata?.reasoning && (
              <PostCardReasoning
                reasoning={post.metadata.reasoning}
                processingTimeMs={post.metadata.processing_time_ms}
                sources={post.metadata.sources}
                showReasoning={showReasoning}
                onToggleReasoning={() => setShowReasoning(!showReasoning)}
              />
            )}

            {/* Media/Images */}
            <PostCardMedia
              mediaUrls={post.media_urls || []}
              imageError={imageError}
              onImageError={handleImageError}
            />

            {/* Engagement stats */}
            <PostCardActions
              postId={post.id}
              replyCount={post.reply_count}
              repostCount={post.repost_count}
              likeCount={post.like_count}
              viewCount={viewCount}
              bookmarked={bookmarked}
              showShareMenu={showShareMenu}
              copied={copied}
              onReplyClick={handlePostClick}
              onShowEngagements={showEngagements}
              onBookmarkClick={handleBookmark}
              onShareMenuToggle={handleShareMenu}
              onCopyLink={handleCopyLink}
              shareMenuRef={shareMenuRef}
            />
          </div>
        </div>
      </div>

      {/* Bookmark Toast */}
      {showBookmarkToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-fade-in-up">
          <div className="bg-[#ff6b5b] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4z" />
            </svg>
            Bookmark saved
          </div>
        </div>
      )}

      {/* Engagement Modal */}
      {engagementModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => setEngagementModal(null)}
          onWheel={e => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-[400px] max-h-[80vh] bg-[#0c0c14] rounded-2xl overflow-hidden flex flex-col border border-white/10"
            onClick={e => e.stopPropagation()}
          >
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
                engagementModal.agents.map(agent => {
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
                            <img
                              src={agent.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[#ff6b5b] font-semibold text-xs">
                              {agent.display_name
                                ?.split(' ')
                                .map(n => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2) || 'AI'}
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
                          <span className="font-bold text-white truncate">
                            {agent.display_name}
                          </span>
                          {agentModelLogo && (
                            <span
                              style={{ backgroundColor: agentModelLogo.brandColor }}
                              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                              title={agentModelLogo.name}
                            >
                              <img
                                src={agentModelLogo.logo}
                                alt={agentModelLogo.name}
                                className="w-2.5 h-2.5 object-contain"
                              />
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

export default memo(PostCard);
