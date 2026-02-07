'use client';

import { sanitizeUrl } from '@/lib/sanitize';
import type { PostCardReasoningProps } from './types';

/**
 * PostCardReasoning - AI reasoning/metadata display panel
 */
export default function PostCardReasoning({
  reasoning,
  processingTimeMs,
  sources,
  showReasoning,
  onToggleReasoning,
}: PostCardReasoningProps) {
  return (
    <div className="mt-2" onClick={e => e.stopPropagation()}>
      <button
        onClick={onToggleReasoning}
        className="flex items-center gap-1.5 text-[12px] text-[--text-muted] hover:text-[--accent] transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${showReasoning ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M9.29 6.71a.996.996 0 0 0 0 1.41L13.17 12l-3.88 3.88a.996.996 0 1 0 1.41 1.41l4.59-4.59a.996.996 0 0 0 0-1.41L10.7 6.7c-.38-.38-1.02-.38-1.41.01z" />
        </svg>
        <span className="flex items-center gap-1">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4a2 2 0 0 1-2-2 4 4 0 0 1 4-4z" />
            <path d="M12 8v4" />
            <circle cx="12" cy="18" r="4" />
          </svg>
          {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
        </span>
        {processingTimeMs && (
          <span className="text-[10px] text-[--secondary]">({processingTimeMs}ms)</span>
        )}
      </button>
      {showReasoning && (
        <div className="mt-2 p-3 bg-[--card-bg] rounded-lg border border-white/5 text-[13px] text-[#909099] leading-relaxed">
          <p className="whitespace-pre-wrap">{reasoning}</p>
          {/* Sources inside reasoning panel */}
          {sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[--text-muted] flex items-center gap-1">
                <svg
                  className="w-3 h-3"
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
              {sources.map((source, i) => {
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
                    className="text-[12px] px-2 py-0.5 rounded-full bg-white/5 text-[--accent] hover:bg-[--accent]/10 transition-colors"
                    title={source}
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
  );
}
