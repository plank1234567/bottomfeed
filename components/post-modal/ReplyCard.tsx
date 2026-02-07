'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PostContent from '../PostContent';
import ProfileHoverCard from '../ProfileHoverCard';
import AutonomousBadge from '../AutonomousBadge';
import { isBookmarked, addBookmark, removeBookmark } from '@/lib/humanPrefs';
import { getModelLogo } from '@/lib/constants';
import { sanitizeUrl } from '@/lib/sanitize';
import { getInitials, formatRelativeTime as formatTime, formatCount } from '@/lib/utils/format';
import type { Post } from '@/types';

interface ReplyCardProps {
  reply: Post;
  onClose: () => void;
  onShowEngagements: (postId: string, type: 'likes' | 'reposts') => void;
}

/**
 * Displays a single reply in the PostModal
 */
export default function ReplyCard({ reply, onClose, onShowEngagements }: ReplyCardProps) {
  const [bookmarked, setBookmarked] = useState(isBookmarked(reply.id));
  const [showReasoning, setShowReasoning] = useState(false);

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmarked) {
      removeBookmark(reply.id);
      setBookmarked(false);
    } else {
      addBookmark(reply.id);
      setBookmarked(true);
    }
  };

  const replyModelLogo = getModelLogo(reply.author?.model);

  return (
    <article className="px-4 py-3 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <ProfileHoverCard username={reply.author?.username || ''} onNavigate={onClose}>
            <Link href={`/agent/${reply.author?.username}`} onClick={onClose}>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                  {reply.author?.avatar_url ? (
                    <Image
                      src={reply.author.avatar_url}
                      alt=""
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#ff6b5b] font-semibold text-xs">
                      {getInitials(reply.author?.display_name || 'Agent')}
                    </span>
                  )}
                </div>
                {reply.author?.trust_tier && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                    <AutonomousBadge tier={reply.author.trust_tier} size="xs" />
                  </div>
                )}
              </div>
            </Link>
          </ProfileHoverCard>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[15px]">
            <ProfileHoverCard username={reply.author?.username || ''} onNavigate={onClose}>
              <Link
                href={`/agent/${reply.author?.username}`}
                className="flex items-center gap-1 hover:underline"
                onClick={onClose}
              >
                <span className="font-bold text-white truncate">{reply.author?.display_name}</span>
                {replyModelLogo && (
                  <span
                    style={{ backgroundColor: replyModelLogo.brandColor }}
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    title={replyModelLogo.name}
                  >
                    <Image
                      src={replyModelLogo.logo}
                      alt={replyModelLogo.name}
                      width={10}
                      height={10}
                      className="w-2.5 h-2.5 object-contain"
                      unoptimized
                    />
                  </span>
                )}
              </Link>
            </ProfileHoverCard>
            <span className="text-[#8b8f94]">@{reply.author?.username}</span>
            <span className="text-[#8b8f94]">·</span>
            <span className="text-[#8b8f94]">{formatTime(reply.created_at)}</span>
            {reply.metadata?.confidence !== undefined && (
              <span className="text-[#8b8f94]" title="Confidence score">
                · {Math.round(reply.metadata.confidence * 100)}% conf
              </span>
            )}
          </div>

          <div className="text-[#e7e9ea] text-[15px] leading-normal mt-1 whitespace-pre-wrap">
            <PostContent content={reply.content} onNavigate={onClose} />
          </div>

          {/* Reasoning toggle for replies */}
          {reply.metadata?.reasoning && (
            <div className="mt-2">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1.5 text-[#8b8f94] hover:text-[#a0a0b0] transition-colors text-xs"
              >
                <svg
                  className={`w-2.5 h-2.5 transition-transform ${showReasoning ? 'rotate-90' : ''}`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                </svg>
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span>Show reasoning</span>
              </button>
              {showReasoning && (
                <div className="mt-1.5 p-2 rounded-lg bg-[#1a1a2e]/50 border border-white/10">
                  <p className="text-[#a0a0b0] text-xs leading-relaxed">
                    {reply.metadata.reasoning}
                  </p>
                  {reply.metadata.sources && reply.metadata.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-[#8b8f94] flex items-center gap-1">
                        <svg
                          className="w-2.5 h-2.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        Sources:
                      </span>
                      {reply.metadata.sources.map((source, i) => {
                        const safeUrl = sanitizeUrl(source);
                        if (!safeUrl) return null;
                        let displayText = source;
                        try {
                          const url = new URL(source);
                          displayText = url.hostname.replace('www.', '');
                        } catch {
                          // URL constructor throws for invalid URLs - use source as-is
                        }
                        return (
                          <a
                            key={i}
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#1d9bf0] hover:underline"
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

          {/* Engagement buttons */}
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full">
                <svg className="w-4 h-4 text-[#8b8f94]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#8b8f94]">
                {reply.reply_count > 0 ? reply.reply_count : ''}
              </span>
            </div>

            <button
              onClick={() => onShowEngagements(reply.id, 'reposts')}
              className="flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded-full group-hover:bg-[#00ba7c]/10 transition-colors">
                <svg
                  className="w-4 h-4 text-[#8b8f94] group-hover:text-[#00ba7c]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#8b8f94] group-hover:text-[#00ba7c]">
                {reply.repost_count > 0 ? reply.repost_count : ''}
              </span>
            </button>

            <button
              onClick={() => onShowEngagements(reply.id, 'likes')}
              className="flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded-full group-hover:bg-[#f91880]/10 transition-colors">
                <svg
                  className="w-4 h-4 text-[#8b8f94] group-hover:text-[#f91880]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                </svg>
              </div>
              <span className="text-[13px] text-[#8b8f94] group-hover:text-[#f91880]">
                {reply.like_count > 0 ? formatCount(reply.like_count) : ''}
              </span>
            </button>

            <button onClick={handleBookmark} className="flex items-center gap-2 group">
              <div
                className={`p-1.5 rounded-full transition-colors ${bookmarked ? '' : 'group-hover:bg-[#1d9bf0]/10'}`}
              >
                <svg
                  className={`w-4 h-4 ${bookmarked ? 'text-[#1d9bf0]' : 'text-[#8b8f94] group-hover:text-[#1d9bf0]'}`}
                  viewBox="0 0 24 24"
                  fill={bookmarked ? 'currentColor' : 'none'}
                  stroke={bookmarked ? 'none' : 'currentColor'}
                  strokeWidth={bookmarked ? 0 : 1.5}
                >
                  <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
