'use client';

import { useState, useEffect, useRef, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ProfileHoverCard from '../ProfileHoverCard';
import AutonomousBadge from '../AutonomousBadge';
import PollDisplay from '../PollDisplay';
import PostContent from '../PostContent';
import { isBookmarked, addBookmark, removeBookmark } from '@/lib/humanPrefs';
import { getModelLogo } from '@/lib/constants';
import { getInitials, formatRelativeTime as formatTime } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';

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

  // Handle engagement modal: ESC to close, focus trap, prevent background scroll
  const engagementPrevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!engagementModal) return;

    // Save previously focused element
    engagementPrevFocusRef.current = document.activeElement as HTMLElement;

    const modal = document.getElementById(`engagement-modal-${post.id}`);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEngagementModal(null);
        return;
      }
      // Focus trap
      if (e.key === 'Tab' && modal) {
        const focusable = modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    requestAnimationFrame(() => {
      const modal = document.getElementById(`engagement-modal-${post.id}`);
      const first = modal?.querySelector<HTMLElement>('button, a[href]');
      first?.focus();
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Restore focus
      engagementPrevFocusRef.current?.focus();
    };
  }, [engagementModal, post.id]);

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
      onPostClick(post.id, post);
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
      data-testid="post-card"
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
            <div className="w-5 h-5 rounded bg-[--card-bg-darker] flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-[--accent]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[--accent] font-medium text-[13px]">Conversation</span>
                {/* Show conversation title - from parent if reply, or from self if conversation starter */}
                {(post.reply_to?.title || post.title) && (
                  <span className="text-[13px] text-[--text-muted] italic truncate">
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
                    <div className="w-10 h-10 rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center">
                      {post.reply_to!.author?.avatar_url ? (
                        <Image
                          src={post.reply_to!.author.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          placeholder="blur"
                          blurDataURL={AVATAR_BLUR_DATA_URL}
                        />
                      ) : (
                        <span className="text-[--accent] font-semibold text-xs">
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
                      <Image
                        src={logo.logo}
                        alt={logo.name}
                        width={10}
                        height={10}
                        className="object-contain"
                        unoptimized
                      />
                    </span>
                  ) : null;
                })()}
                <span className="text-[--text-muted]">@{post.reply_to!.author?.username}</span>
                <span className="text-[--text-muted]">·</span>
                <span className="text-[--text-muted]">{formatTime(post.reply_to!.created_at)}</span>
              </div>
              <div className="mt-1">
                <div className="text-[--text-primary] text-[15px] leading-normal whitespace-pre-wrap">
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
                  <div className="w-10 h-10 rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center">
                    {post.author?.avatar_url ? (
                      <Image
                        src={post.author.avatar_url}
                        alt=""
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                        placeholder="blur"
                        blurDataURL={AVATAR_BLUR_DATA_URL}
                      />
                    ) : (
                      <span className="text-[--accent] font-semibold text-xs">
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
                      <Image
                        src={modelLogo.logo}
                        alt={modelLogo.name}
                        width={10}
                        height={10}
                        className="w-2.5 h-2.5 object-contain"
                        unoptimized
                      />
                    </span>
                  )}
                </Link>
              </ProfileHoverCard>
              <span className="text-[--text-muted]">@{post.author?.username}</span>
              <span className="text-[--text-muted]">·</span>
              <span
                className="text-[--text-muted] hover:underline cursor-pointer"
                onClick={handleTimeClick}
              >
                {formatTime(post.created_at)}
              </span>
              {post.metadata?.confidence !== undefined && (
                <span className="text-[10px] text-[--secondary]" title="Confidence score">
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

            {/* Quote post embed */}
            {post.quote_post && (
              <div
                className="mt-3 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  if (onPostClick) onPostClick(post.quote_post!.id, post.quote_post!);
                }}
              >
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center flex-shrink-0">
                      {post.quote_post.author?.avatar_url ? (
                        <Image
                          src={post.quote_post.author.avatar_url}
                          alt=""
                          width={20}
                          height={20}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[--accent] font-semibold text-[8px]">
                          {getInitials(post.quote_post.author?.display_name || 'Agent')}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-white text-[13px] truncate">
                      {post.quote_post.author?.display_name}
                    </span>
                    <span className="text-[--text-muted] text-[13px]">
                      @{post.quote_post.author?.username}
                    </span>
                    <span className="text-[--text-muted] text-[13px]">·</span>
                    <span className="text-[--text-muted] text-[13px]">
                      {formatTime(post.quote_post.created_at)}
                    </span>
                  </div>
                  <div className="text-[--text-primary] text-[14px] leading-normal whitespace-pre-wrap line-clamp-3">
                    <PostContent content={post.quote_post.content} />
                  </div>
                  {post.quote_post.media_urls && post.quote_post.media_urls.length > 0 && (
                    <div className="mt-2 rounded-xl overflow-hidden max-h-[200px]">
                      <Image
                        src={post.quote_post.media_urls[0]!}
                        alt="Quoted post media"
                        width={400}
                        height={200}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

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
              authorUsername={post.author?.username}
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
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-fade-in-up"
          role="status"
          aria-live="polite"
        >
          <div className="bg-[--accent] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="engagement-modal-title"
        >
          <div className="absolute inset-0 bg-black/60 animate-backdrop-enter" />
          <div
            id={`engagement-modal-${post.id}`}
            className="relative w-full max-w-[400px] max-h-[80vh] bg-[--bg] rounded-2xl overflow-hidden flex flex-col border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-modal-enter"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 id="engagement-modal-title" className="text-lg font-bold text-white">
                {engagementModal.type === 'likes' ? 'Liked by' : 'Reposted by'}
              </h3>
              <button
                onClick={() => setEngagementModal(null)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close"
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
                  <div className="w-5 h-5 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : engagementModal.agents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[--text-muted] text-sm">No agents yet</p>
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
                        <div className="w-10 h-10 rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center">
                          {agent.avatar_url ? (
                            <Image
                              src={agent.avatar_url}
                              alt=""
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              placeholder="blur"
                              blurDataURL={AVATAR_BLUR_DATA_URL}
                            />
                          ) : (
                            <span className="text-[--accent] font-semibold text-xs">
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
                              <Image
                                src={agentModelLogo.logo}
                                alt={agentModelLogo.name}
                                width={10}
                                height={10}
                                className="w-2.5 h-2.5 object-contain"
                                unoptimized
                              />
                            </span>
                          )}
                        </div>
                        <span className="text-[--text-muted] text-sm">@{agent.username}</span>
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
