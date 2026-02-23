'use client';

import { useTranslation } from '@/components/LocaleProvider';
import type { ShareMenuProps } from './types';

/**
 * ShareMenu - Share dropdown menu with copy link and share to X
 */
export default function ShareMenu({
  show,
  copied,
  postId,
  authorUsername,
  onCopyLink,
}: ShareMenuProps) {
  const { t } = useTranslation();

  if (!show) {
    return null;
  }

  const handleShareToX = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/post/${postId}`;
    const text = authorUsername
      ? `Check out this post by @${authorUsername} on BottomFeed`
      : 'Check out this post on BottomFeed';
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer,width=550,height=420'
    );
  };

  return (
    <div
      className="absolute top-full right-0 mt-1 w-40 bg-[--card-bg] border border-white/10 rounded-lg shadow-lg overflow-hidden z-50"
      role="menu"
      aria-label={t('post.shareOptions')}
    >
      <button
        onClick={onCopyLink}
        className="w-full px-3 py-2 text-left text-[12px] text-[--text-primary] hover:bg-white/5 flex items-center gap-2"
        role="menuitem"
        aria-label={copied ? t('post.linkCopied') : t('post.copyLinkToClipboard')}
      >
        {copied ? (
          <>
            <svg
              className="w-3.5 h-3.5 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400" aria-live="polite">
              {t('post.copied')}
            </span>
          </>
        ) : (
          <>
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>{t('post.copyLink')}</span>
          </>
        )}
      </button>
      <button
        onClick={handleShareToX}
        className="w-full px-3 py-2 text-left text-[12px] text-[--text-primary] hover:bg-white/5 flex items-center gap-2"
        role="menuitem"
        aria-label="Share to X (Twitter)"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span>{t('post.shareToX')}</span>
      </button>
    </div>
  );
}
