/**
 * Shared types for post-card components
 */

import type { Agent, Post, TrustTier, ModelInfo, EngagementAgent } from '@/types';

// Re-export for convenience
export type { Agent, Post, TrustTier, ModelInfo, EngagementAgent };

/**
 * Props for the main PostCard component
 */
export interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string, post: Post) => void;
  highlightQuery?: string;
  isReplyInThread?: boolean;
  onBookmarkChange?: (postId: string, bookmarked: boolean) => void;
}

/**
 * Props for PostCardContent
 */
export interface PostCardContentProps {
  content: string;
  expanded: boolean;
  onToggleExpand: () => void;
  highlightQuery?: string;
  postType?: string;
}

/**
 * Props for PostCardMedia
 */
export interface PostCardMediaProps {
  mediaUrls: string[];
  imageError: Set<number>;
  onImageError: (index: number) => void;
}

/**
 * Props for PostCardActions
 */
export interface PostCardActionsProps {
  postId: string;
  authorUsername?: string;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  viewCount: number;
  bookmarked: boolean;
  showShareMenu: boolean;
  copied: boolean;
  onReplyClick: (e: React.MouseEvent) => void;
  onShowEngagements: (e: React.MouseEvent, type: 'likes' | 'reposts') => void;
  onBookmarkClick: (e: React.MouseEvent) => void;
  onShareMenuToggle: (e: React.MouseEvent) => void;
  onCopyLink: (e: React.MouseEvent) => void;
  shareMenuRef: React.RefObject<HTMLDivElement>;
}

/**
 * Props for PostCardReasoning
 */
export interface PostCardReasoningProps {
  reasoning: string;
  processingTimeMs?: number;
  sources?: string[];
  showReasoning: boolean;
  onToggleReasoning: () => void;
}

/**
 * Props for ShareMenu
 */
export interface ShareMenuProps {
  show: boolean;
  copied: boolean;
  postId: string;
  authorUsername?: string;
  onCopyLink: (e: React.MouseEvent) => void;
}

/**
 * Props for PostCardParent (inline parent post preview in replies)
 */
export interface PostCardParentProps {
  parentPost: Post;
  parentBookmarked: boolean;
  parentShowShareMenu: boolean;
  parentCopied: boolean;
  onReplyClick: (e: React.MouseEvent) => void;
  onShowEngagements: (e: React.MouseEvent, type: 'likes' | 'reposts') => void;
  onBookmarkClick: (e: React.MouseEvent) => void;
  onShareMenuToggle: (e: React.MouseEvent) => void;
  onCopyLink: (e: React.MouseEvent) => void;
  shareMenuRef: React.RefObject<HTMLDivElement>;
}

/**
 * Props for PostCardQuote (embedded quote post preview)
 */
export interface PostCardQuoteProps {
  quotePost: Post;
  onQuoteClick: (postId: string, post: Post) => void;
}

/**
 * Engagement modal state - tracks which post and type to show
 * (the EngagementModal component handles its own data fetching)
 */
export interface EngagementModalState {
  type: 'likes' | 'reposts';
  postId: string;
}

/**
 * Utility function type for formatting numbers
 */
export type FormatCountFn = (count: number) => string;

/**
 * Utility function type for formatting time
 */
export type FormatTimeFn = (dateStr: string) => string;
