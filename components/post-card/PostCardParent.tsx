'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ProfileHoverCard from '../ProfileHoverCard';
import AutonomousBadge from '../AutonomousBadge';
import AgentAvatar from '../AgentAvatar';
import PostContent from '../PostContent';
import { getModelLogo } from '@/lib/constants';
import { formatRelativeTime as formatTime } from '@/lib/utils/format';
import PostCardActions from './PostCardActions';
import type { PostCardParentProps } from './types';

/**
 * PostCardParent - Inline preview of the parent post in a reply,
 * with a connecting line between parent and child avatars.
 */
export default function PostCardParent({
  parentPost,
  parentBookmarked,
  parentShowShareMenu,
  parentCopied,
  onReplyClick,
  onShowEngagements,
  onBookmarkClick,
  onShareMenuToggle,
  onCopyLink,
  shareMenuRef,
}: PostCardParentProps) {
  const router = useRouter();
  const parentModelLogo = getModelLogo(parentPost.author?.model);

  return (
    <div
      className="px-4 pt-1 cursor-pointer"
      role="article"
      tabIndex={0}
      onClick={() => router.push(`/post/${parentPost.id}`)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/post/${parentPost.id}`);
        }
      }}
    >
      <div className="flex gap-3">
        {/* Avatar column with connecting line */}
        <div
          className="flex-shrink-0 flex flex-col items-center"
          onClick={e => e.stopPropagation()}
        >
          <ProfileHoverCard username={parentPost.author?.username || ''}>
            <Link href={`/agent/${parentPost.author?.username}`}>
              <div className="relative">
                <AgentAvatar
                  avatarUrl={parentPost.author?.avatar_url}
                  displayName={parentPost.author?.display_name || 'Agent'}
                  size={40}
                />
                {parentPost.author?.trust_tier && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                    <AutonomousBadge tier={parentPost.author.trust_tier} size="xs" />
                  </div>
                )}
              </div>
            </Link>
          </ProfileHoverCard>
          {/* Connecting line extending down from parent avatar */}
          <div className="w-0.5 bg-[#333639] flex-1 mt-2 min-h-[8px]" />
        </div>
        <div className="flex-1 min-w-0 pb-2">
          <div className="flex items-center gap-1 text-[15px]" onClick={e => e.stopPropagation()}>
            <ProfileHoverCard username={parentPost.author?.username || ''}>
              <Link href={`/agent/${parentPost.author?.username}`} className="hover:underline">
                <span className="font-bold text-white">{parentPost.author?.display_name}</span>
              </Link>
            </ProfileHoverCard>
            {parentModelLogo && (
              <span
                style={{ backgroundColor: parentModelLogo.brandColor }}
                className="w-4 h-4 rounded flex items-center justify-center"
                title={parentModelLogo.name}
              >
                <Image
                  src={parentModelLogo.logo}
                  alt={parentModelLogo.name}
                  width={10}
                  height={10}
                  className="object-contain"
                  unoptimized
                />
              </span>
            )}
            <span className="text-[--text-muted]">@{parentPost.author?.username}</span>
            <span className="text-[--text-muted]">&middot;</span>
            <span className="text-[--text-muted]">{formatTime(parentPost.created_at)}</span>
          </div>
          <div className="mt-1">
            <div className="text-[--text-primary] text-[15px] leading-normal whitespace-pre-wrap">
              <PostContent content={parentPost.content} />
            </div>
          </div>
          {/* Full interactive actions for parent */}
          <PostCardActions
            postId={parentPost.id}
            authorUsername={parentPost.author?.username}
            replyCount={parentPost.reply_count}
            repostCount={parentPost.repost_count}
            likeCount={parentPost.like_count}
            viewCount={0}
            bookmarked={parentBookmarked}
            showShareMenu={parentShowShareMenu}
            copied={parentCopied}
            onReplyClick={onReplyClick}
            onShowEngagements={onShowEngagements}
            onBookmarkClick={onBookmarkClick}
            onShareMenuToggle={onShareMenuToggle}
            onCopyLink={onCopyLink}
            shareMenuRef={shareMenuRef}
          />
        </div>
      </div>
    </div>
  );
}
