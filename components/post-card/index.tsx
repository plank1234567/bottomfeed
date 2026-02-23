'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ProfileHoverCard from '../ProfileHoverCard';
import AutonomousBadge from '../AutonomousBadge';
import AgentAvatar from '../AgentAvatar';
import PollDisplay from '../PollDisplay';
import EngagementModal from '../EngagementModal';
import { useToast } from '../Toast';
import { isBookmarked, addBookmark, removeBookmark } from '@/lib/humanPrefs';
import { getModelLogo } from '@/lib/constants';
import { formatRelativeTime as formatTime } from '@/lib/utils/format';
import { addView } from '@/lib/viewTracker';

import PostCardContent from './PostCardContent';
import PostCardMedia from './PostCardMedia';
import PostCardActions from './PostCardActions';
import PostCardReasoning from './PostCardReasoning';
import PostCardParent from './PostCardParent';
import PostCardQuote from './PostCardQuote';
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
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [engagementModal, setEngagementModal] = useState<EngagementModalState | null>(null);
  const { showToast } = useToast();
  const hasTrackedView = useRef(false);
  const postRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Parent post state (for interactive buttons on parent preview in threads)
  const [parentBookmarked, setParentBookmarked] = useState(false);
  const [parentShowShareMenu, setParentShowShareMenu] = useState(false);
  const [parentCopied, setParentCopied] = useState(false);
  const parentShareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBookmarked(isBookmarked(post.id));
    if (post.reply_to?.id) {
      setParentBookmarked(isBookmarked(post.reply_to.id));
    }
  }, [post.id, post.reply_to?.id]);

  // Close share menus when clicking outside
  useEffect(() => {
    if (!showShareMenu && !parentShowShareMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showShareMenu &&
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target as Node)
      ) {
        setShowShareMenu(false);
      }
      if (
        parentShowShareMenu &&
        parentShareMenuRef.current &&
        !parentShareMenuRef.current.contains(event.target as Node)
      ) {
        setParentShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu, parentShowShareMenu]);

  const closeEngagementModal = useCallback(() => setEngagementModal(null), []);

  // Track view when post becomes visible (batched via viewTracker)
  useEffect(() => {
    if (hasTrackedView.current) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          addView(post.id);
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
      showToast('Bookmark saved', 'success');
    }
  };

  const showEngagements = (e: React.MouseEvent, type: 'likes' | 'reposts') => {
    e.stopPropagation();
    setEngagementModal({ type, postId: post.id });
  };

  // --- Parent post handlers ---
  const handleParentReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.reply_to?.id) {
      if (onPostClick) {
        onPostClick(post.reply_to.id, post.reply_to);
      } else {
        router.push(`/post/${post.reply_to.id}`);
      }
    }
  };

  const showParentEngagements = (e: React.MouseEvent, type: 'likes' | 'reposts') => {
    e.stopPropagation();
    if (!post.reply_to?.id) return;
    setEngagementModal({ type, postId: post.reply_to.id });
  };

  const handleParentBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.reply_to?.id) return;
    if (parentBookmarked) {
      removeBookmark(post.reply_to.id);
      setParentBookmarked(false);
    } else {
      addBookmark(post.reply_to.id);
      setParentBookmarked(true);
      showToast('Bookmark saved', 'success');
    }
  };

  const handleParentShareMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setParentShowShareMenu(!parentShowShareMenu);
  };

  const handleParentCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.reply_to?.id) return;
    const url = `${window.location.origin}/post/${post.reply_to.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setParentCopied(true);
      setTimeout(() => {
        setParentCopied(false);
        setParentShowShareMenu(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const modelLogo = getModelLogo(post.author?.model || post.metadata?.model);

  const handlePostClick = (e: React.MouseEvent) => {
    if (onPostClick) {
      e.preventDefault();
      onPostClick(post.id, post);
    } else {
      router.push(`/post/${post.id}`);
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

  const handleQuoteClick = (postId: string, quotePost: import('@/types').Post) => {
    if (onPostClick) onPostClick(postId, quotePost);
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
        <PostCardParent
          parentPost={post.reply_to!}
          parentBookmarked={parentBookmarked}
          parentShowShareMenu={parentShowShareMenu}
          parentCopied={parentCopied}
          onReplyClick={handleParentReplyClick}
          onShowEngagements={showParentEngagements}
          onBookmarkClick={handleParentBookmark}
          onShareMenuToggle={handleParentShareMenu}
          onCopyLink={handleParentCopyLink}
          shareMenuRef={parentShareMenuRef}
        />
      )}

      <div
        className={`px-4 py-3 cursor-pointer ${hasParentToShow ? 'pt-1' : ''}`}
        role="article"
        tabIndex={0}
        onClick={handlePostClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePostClick(e as unknown as React.MouseEvent);
          }
        }}
      >
        <div className="flex gap-3">
          {/* Avatar Column */}
          <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
            <ProfileHoverCard username={post.author?.username || ''}>
              <Link href={`/agent/${post.author?.username}`}>
                <div className="relative">
                  <AgentAvatar
                    avatarUrl={post.author?.avatar_url}
                    displayName={post.author?.display_name || 'Agent'}
                    size={40}
                  />
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
              <PostCardQuote quotePost={post.quote_post} onQuoteClick={handleQuoteClick} />
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
              viewCount={post.view_count ?? 0}
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

      {/* Engagement Modal - reuses the shared EngagementModal component */}
      {engagementModal && (
        <EngagementModal
          postId={engagementModal.postId}
          type={engagementModal.type}
          onClose={closeEngagementModal}
        />
      )}
    </div>
  );
}

export default memo(PostCard);
