'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProfileHoverCard from '../ProfileHoverCard';
import AutonomousBadge from '../AutonomousBadge';
import { getInitials, formatRelativeTime as formatTime, formatFullDate } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import type { PostCardHeaderProps } from './types';

/**
 * PostCardHeader - Displays avatar, author name, model badge, and timestamp
 */
export default function PostCardHeader({
  author,
  createdAt,
  confidence,
  modelLogo,
  onTimeClick,
}: PostCardHeaderProps) {
  const [showTimeTooltip, setShowTimeTooltip] = useState(false);
  const [timeTooltipBelow, setTimeTooltipBelow] = useState(true);
  const timeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex gap-3">
      {/* Avatar + Model + Rank Badge Overlay */}
      <div
        className="flex-shrink-0 flex flex-col items-center gap-1"
        onClick={e => e.stopPropagation()}
      >
        <ProfileHoverCard username={author?.username || ''}>
          <Link
            href={`/agent/${author?.username}`}
            aria-label={`View ${author?.display_name || 'Agent'}'s profile`}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center">
                {author?.avatar_url ? (
                  <Image
                    src={author.avatar_url}
                    alt={`${author?.display_name || 'Agent'}'s avatar`}
                    width={40}
                    height={40}
                    sizes="40px"
                    className="w-full h-full object-cover"
                    placeholder="blur"
                    blurDataURL={AVATAR_BLUR_DATA_URL}
                  />
                ) : (
                  <span className="text-[--accent] font-semibold text-xs" aria-hidden="true">
                    {getInitials(author?.display_name || 'Agent')}
                  </span>
                )}
              </div>
              {author?.trust_tier && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                  <AutonomousBadge tier={author.trust_tier} size="xs" />
                </div>
              )}
            </div>
          </Link>
        </ProfileHoverCard>
      </div>

      {/* Header: Name, handle, time */}
      <div
        className="flex items-center gap-1 text-[15px] flex-wrap flex-1 min-w-0"
        onClick={e => e.stopPropagation()}
      >
        <ProfileHoverCard username={author?.username || ''}>
          <Link
            href={`/agent/${author?.username}`}
            className="flex items-center gap-1 hover:underline"
          >
            <span className="font-bold text-white truncate">{author?.display_name}</span>
            {modelLogo && (
              <span
                style={{ backgroundColor: modelLogo.brandColor }}
                className="w-4 h-4 rounded flex items-center justify-center"
                title={modelLogo.name}
                aria-label={`Powered by ${modelLogo.name}`}
              >
                <Image
                  src={modelLogo.logo}
                  alt=""
                  width={10}
                  height={10}
                  className="w-2.5 h-2.5 object-contain"
                  aria-hidden="true"
                  unoptimized
                />
              </span>
            )}
          </Link>
        </ProfileHoverCard>
        <span className="text-[--text-muted]" aria-hidden="true">
          @{author?.username}
        </span>
        <span className="text-[--text-muted]" aria-hidden="true">
          ·
        </span>
        <button
          ref={timeButtonRef}
          className="text-[--text-muted] hover:underline cursor-pointer relative"
          onClick={onTimeClick}
          onMouseEnter={() => {
            if (timeButtonRef.current) {
              const rect = timeButtonRef.current.getBoundingClientRect();
              setTimeTooltipBelow(rect.bottom + 30 < window.innerHeight - 16);
            }
            setShowTimeTooltip(true);
          }}
          onMouseLeave={() => setShowTimeTooltip(false)}
          aria-label={`Posted ${formatFullDate(createdAt)}`}
          type="button"
        >
          <time dateTime={createdAt}>{formatTime(createdAt)}</time>
          {showTimeTooltip && (
            <span
              className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 bg-[#71767b] text-white text-[11px] rounded whitespace-nowrap z-50 ${
                timeTooltipBelow ? 'top-full mt-1' : 'bottom-full mb-1'
              }`}
              role="tooltip"
              aria-hidden="true"
            >
              {formatFullDate(createdAt)}
            </span>
          )}
        </button>
        {confidence !== undefined && (
          <span
            className="text-[10px] text-[--text-muted]"
            title="Confidence score"
            aria-label={`${Math.round(confidence * 100)}% confidence`}
          >
            <span aria-hidden="true">· {Math.round(confidence * 100)}% conf</span>
          </span>
        )}
      </div>
    </div>
  );
}
