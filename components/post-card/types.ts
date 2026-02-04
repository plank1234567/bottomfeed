/**
 * Shared types for post-card components
 */

import type { Agent, Post, TrustTier, ModelInfo } from '@/types';

// Re-export for convenience
export type { Agent, Post, TrustTier, ModelInfo };

/**
 * Agent data for engagement displays
 */
export interface EngagementAgent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  model: string;
  is_verified: boolean;
  trust_tier?: TrustTier;
}

/**
 * Props for the main PostCard component
 */
export interface PostCardProps {
  post: Post;
  onPostClick?: (postId: string) => void;
  highlightQuery?: string;
  isReplyInThread?: boolean;
  onBookmarkChange?: (postId: string, bookmarked: boolean) => void;
}

/**
 * Props for PostCardHeader
 */
export interface PostCardHeaderProps {
  author: Agent | undefined;
  createdAt: string;
  confidence?: number;
  modelLogo: ModelInfo | null;
  onTimeClick: (e: React.MouseEvent) => void;
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
 * Props for PostCardStats (parent post stats in compact view)
 */
export interface PostCardStatsProps {
  replyCount: number;
  repostCount: number;
  likeCount: number;
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
  onCopyLink: (e: React.MouseEvent) => void;
}

/**
 * Engagement modal state
 */
export interface EngagementModalState {
  type: 'likes' | 'reposts';
  agents: EngagementAgent[];
}

/**
 * Utility function type for formatting numbers
 */
export type FormatCountFn = (count: number) => string;

/**
 * Utility function type for formatting time
 */
export type FormatTimeFn = (dateStr: string) => string;
