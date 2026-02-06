'use client';

import { formatCount } from '@/lib/utils/format';
import ShareMenu from './ShareMenu';
import type { PostCardActionsProps } from './types';

/**
 * PostCardActions - Reply, repost, like, bookmark, share buttons
 */
export default function PostCardActions({
  replyCount,
  repostCount,
  likeCount,
  viewCount,
  bookmarked,
  showShareMenu,
  copied,
  onReplyClick,
  onShowEngagements,
  onBookmarkClick,
  onShareMenuToggle,
  onCopyLink,
  shareMenuRef,
}: PostCardActionsProps) {
  return (
    <div
      className="flex items-center justify-between mt-3 max-w-[425px]"
      onClick={e => e.stopPropagation()}
      role="group"
      aria-label="Post actions"
    >
      {/* Replies */}
      <button
        className="flex items-center gap-2 group"
        onClick={onReplyClick}
        aria-label={`Reply${replyCount > 0 ? `, ${formatCount(replyCount)} replies` : ''}`}
      >
        <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors">
          <svg
            className="w-[18px] h-[18px] text-[#71767b] group-hover:text-[#1d9bf0]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
          </svg>
        </div>
        <span className="text-[13px] text-[#71767b] group-hover:text-[#1d9bf0]" aria-hidden="true">
          {replyCount > 0 ? formatCount(replyCount) : ''}
        </span>
      </button>

      {/* Reposts - Click to view who reposted */}
      <button
        className="flex items-center gap-2 group"
        onClick={e => onShowEngagements(e, 'reposts')}
        aria-label={`View reposts${repostCount > 0 ? `, ${formatCount(repostCount)} reposts` : ''}`}
      >
        <div className="p-2 rounded-full group-hover:bg-[#00ba7c]/10 transition-colors">
          <svg
            className="w-[18px] h-[18px] text-[#71767b] group-hover:text-[#00ba7c]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
          </svg>
        </div>
        <span className="text-[13px] text-[#71767b] group-hover:text-[#00ba7c]" aria-hidden="true">
          {repostCount > 0 ? formatCount(repostCount) : ''}
        </span>
      </button>

      {/* Likes - Click to view who liked */}
      <button
        className="flex items-center gap-2 group"
        onClick={e => onShowEngagements(e, 'likes')}
        aria-label={`View likes${likeCount > 0 ? `, ${formatCount(likeCount)} likes` : ''}`}
      >
        <div className="p-2 rounded-full group-hover:bg-[#f91880]/10 transition-colors">
          <svg
            className="w-[18px] h-[18px] text-[#71767b] group-hover:text-[#f91880]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
          </svg>
        </div>
        <span className="text-[13px] text-[#71767b] group-hover:text-[#f91880]" aria-hidden="true">
          {likeCount > 0 ? formatCount(likeCount) : ''}
        </span>
      </button>

      {/* Views */}
      <div
        className="flex items-center gap-2 group"
        aria-label={viewCount > 0 ? `${formatCount(viewCount)} views` : 'No views'}
      >
        <div className="p-2 rounded-full">
          <svg
            className="w-[18px] h-[18px] text-[#71767b]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
          </svg>
        </div>
        {viewCount > 0 && (
          <span className="text-[13px] text-[#71767b]" aria-hidden="true">
            {formatCount(viewCount)}
          </span>
        )}
      </div>

      {/* Bookmark */}
      <button
        className="flex items-center group"
        onClick={onBookmarkClick}
        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this post'}
        aria-pressed={bookmarked}
      >
        <div
          className={`p-2 rounded-full transition-colors ${bookmarked ? '' : 'group-hover:bg-[#1d9bf0]/10'}`}
        >
          <svg
            className={`w-[18px] h-[18px] ${bookmarked ? 'text-[#1d9bf0]' : 'text-[#71767b] group-hover:text-[#1d9bf0]'}`}
            viewBox="0 0 24 24"
            fill={bookmarked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={bookmarked ? 0 : 2}
            aria-hidden="true"
          >
            <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4z" />
          </svg>
        </div>
      </button>

      {/* Share Menu */}
      <div className="relative" ref={shareMenuRef as React.RefObject<HTMLDivElement>}>
        <button
          className="flex items-center group"
          onClick={onShareMenuToggle}
          aria-label="Share post"
          aria-expanded={showShareMenu}
          aria-haspopup="menu"
        >
          <div
            className={`p-2 rounded-full transition-colors ${showShareMenu ? 'bg-[#1d9bf0]/10' : 'group-hover:bg-[#1d9bf0]/10'}`}
          >
            <svg
              className={`w-[18px] h-[18px] ${showShareMenu ? 'text-[#1d9bf0]' : 'text-[#71767b] group-hover:text-[#1d9bf0]'}`}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" />
            </svg>
          </div>
        </button>
        <ShareMenu show={showShareMenu} copied={copied} onCopyLink={onCopyLink} />
      </div>
    </div>
  );
}
