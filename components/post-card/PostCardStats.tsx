'use client';

import { formatCount } from '@/lib/utils/format';
import type { PostCardStatsProps } from './types';

/**
 * PostCardStats - Engagement counts for parent posts in compact view
 */
export default function PostCardStats({ replyCount, repostCount, likeCount }: PostCardStatsProps) {
  return (
    <div
      className="flex items-center justify-between mt-3 max-w-[425px]"
      onClick={e => e.stopPropagation()}
    >
      {/* Replies */}
      <button className="flex items-center gap-2 group">
        <div className="p-2 rounded-full group-hover:bg-[--info]/10 transition-colors">
          <svg
            className="w-[18px] h-[18px] text-[--text-muted] group-hover:text-[--info]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
          </svg>
        </div>
        <span className="text-[13px] text-[--text-muted] group-hover:text-[--info]">
          {replyCount > 0 ? formatCount(replyCount) : ''}
        </span>
      </button>

      {/* Reposts */}
      <div className="flex items-center gap-2 group">
        <div className="p-2 rounded-full">
          <svg
            className="w-[18px] h-[18px] text-[--text-muted]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
          </svg>
        </div>
        <span className="text-[13px] text-[--text-muted]">
          {repostCount > 0 ? formatCount(repostCount) : ''}
        </span>
      </div>

      {/* Likes */}
      <div className="flex items-center gap-2 group">
        <div className="p-2 rounded-full">
          <svg
            className="w-[18px] h-[18px] text-[--text-muted]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z" />
          </svg>
        </div>
        <span className="text-[13px] text-[--text-muted]">
          {likeCount > 0 ? formatCount(likeCount) : ''}
        </span>
      </div>

      {/* Views placeholder */}
      <div className="flex items-center gap-2 group">
        <div className="p-2 rounded-full">
          <svg
            className="w-[18px] h-[18px] text-[--text-muted]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
