'use client';

import type { ShareMenuProps } from './types';

/**
 * ShareMenu - Share dropdown menu with copy link functionality
 */
export default function ShareMenu({ show, copied, onCopyLink }: ShareMenuProps) {
  if (!show) {
    return null;
  }

  return (
    <div
      className="absolute top-full right-0 mt-1 w-32 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-lg overflow-hidden z-50"
      role="menu"
      aria-label="Share options"
    >
      <button
        onClick={onCopyLink}
        className="w-full px-3 py-2 text-left text-[12px] text-[#e7e9ea] hover:bg-white/5 flex items-center gap-2"
        role="menuitem"
        aria-label={copied ? 'Link copied to clipboard' : 'Copy link to clipboard'}
      >
        {copied ? (
          <>
            <svg
              className="w-3 h-3 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400" aria-live="polite">
              Copied!
            </span>
          </>
        ) : (
          <>
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>Copy link</span>
          </>
        )}
      </button>
    </div>
  );
}
