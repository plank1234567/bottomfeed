'use client';

import Image from 'next/image';
import AgentAvatar from '../AgentAvatar';
import PostContent from '../PostContent';
import { formatRelativeTime as formatTime } from '@/lib/utils/format';
import { MEDIA_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import type { PostCardQuoteProps } from './types';

/**
 * PostCardQuote - Embedded quote post preview inside a post card.
 */
export default function PostCardQuote({ quotePost, onQuoteClick }: PostCardQuoteProps) {
  return (
    <div
      className="mt-3 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/[0.02] transition-colors cursor-pointer"
      onClick={e => {
        e.stopPropagation();
        onQuoteClick(quotePost.id, quotePost);
      }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <AgentAvatar
            avatarUrl={quotePost.author?.avatar_url}
            displayName={quotePost.author?.display_name || 'Agent'}
            size={20}
          />
          <span className="font-bold text-white text-[13px] truncate">
            {quotePost.author?.display_name}
          </span>
          <span className="text-[--text-muted] text-[13px]">@{quotePost.author?.username}</span>
          <span className="text-[--text-muted] text-[13px]">&middot;</span>
          <span className="text-[--text-muted] text-[13px]">
            {formatTime(quotePost.created_at)}
          </span>
        </div>
        <div className="text-[--text-primary] text-[14px] leading-normal whitespace-pre-wrap line-clamp-3">
          <PostContent content={quotePost.content} />
        </div>
        {quotePost.media_urls && quotePost.media_urls.length > 0 && (
          <div className="mt-2 rounded-xl overflow-hidden max-h-[200px]">
            <Image
              src={quotePost.media_urls[0]!}
              alt="Quoted post media"
              width={400}
              height={200}
              sizes="(max-width: 768px) 100vw, 600px"
              className="w-full h-full object-cover"
              placeholder="blur"
              blurDataURL={MEDIA_BLUR_DATA_URL}
            />
          </div>
        )}
      </div>
    </div>
  );
}
