'use client';

import { useState, useRef, useEffect } from 'react';

interface PostActionsProps {
  postId: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  viewCount: number;
  isBookmarked: boolean;
  onLike: () => void;
  onRepost: () => void;
  onReply: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onViewLikes: () => void;
  onViewReposts: () => void;
}

/**
 * Post action buttons (like, repost, reply, bookmark, share)
 */
export default function PostActions({
  postId,
  likeCount,
  repostCount,
  replyCount,
  viewCount,
  isBookmarked,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  onShare,
  onViewLikes,
  onViewReposts,
}: PostActionsProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Close share menu on outside click
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

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowShareMenu(false);
    }, 1500);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="flex items-center justify-between mt-3 -ml-2">
      {/* Reply */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onReply();
        }}
        className="flex items-center gap-1.5 text-[#71767b] hover:text-[#1d9bf0] transition-colors group"
      >
        <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z" />
          </svg>
        </div>
        {replyCount > 0 && <span className="text-[13px] -ml-1">{formatCount(replyCount)}</span>}
      </button>

      {/* Repost */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRepost();
        }}
        className="flex items-center gap-1.5 text-[#71767b] hover:text-[#00ba7c] transition-colors group"
      >
        <div className="p-2 rounded-full group-hover:bg-[#00ba7c]/10">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
          </svg>
        </div>
        {repostCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewReposts();
            }}
            className="text-[13px] -ml-1 hover:underline"
          >
            {formatCount(repostCount)}
          </button>
        )}
      </button>

      {/* Like */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onLike();
        }}
        className="flex items-center gap-1.5 text-[#71767b] hover:text-[#f91880] transition-colors group"
      >
        <div className="p-2 rounded-full group-hover:bg-[#f91880]/10">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z" />
          </svg>
        </div>
        {likeCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewLikes();
            }}
            className="text-[13px] -ml-1 hover:underline"
          >
            {formatCount(likeCount)}
          </button>
        )}
      </button>

      {/* Views */}
      <div className="flex items-center gap-1.5 text-[#71767b]">
        <div className="p-2">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
          </svg>
        </div>
        {viewCount > 0 && <span className="text-[13px] -ml-1">{formatCount(viewCount)}</span>}
      </div>

      {/* Bookmark & Share */}
      <div className="flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookmark();
          }}
          className={`p-2 rounded-full transition-colors ${
            isBookmarked
              ? 'text-[#1d9bf0]'
              : 'text-[#71767b] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10'
          }`}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isBookmarked ? 0 : 2}>
            <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z" />
          </svg>
        </button>

        <div className="relative" ref={shareMenuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowShareMenu(!showShareMenu);
            }}
            className="p-2 rounded-full text-[#71767b] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 transition-colors"
            title="Share"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" />
            </svg>
          </button>

          {showShareMenu && (
            <div
              className="absolute bottom-full right-0 mb-2 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleCopyLink}
                className="w-full px-4 py-3 text-left text-white hover:bg-white/5 flex items-center gap-3"
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-green-500">Link copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.36 5.64c-1.95-1.96-5.11-1.96-7.07 0L9.88 7.05 8.46 5.64l1.42-1.42c2.73-2.73 7.16-2.73 9.9 0 2.73 2.74 2.73 7.17 0 9.9l-1.42 1.42-1.41-1.42 1.41-1.41c1.96-1.96 1.96-5.12 0-7.07zm-2.12 3.53l-7.07 7.07-1.41-1.41 7.07-7.07 1.41 1.41zm-12.02.71l1.42-1.42 1.41 1.42-1.41 1.41c-1.96 1.96-1.96 5.12 0 7.07 1.95 1.96 5.11 1.96 7.07 0l1.41-1.41 1.42 1.41-1.42 1.42c-2.73 2.73-7.16 2.73-9.9 0-2.73-2.74-2.73-7.17 0-9.9z" />
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
  );
}
