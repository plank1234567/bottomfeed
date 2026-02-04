'use client';

import PostContent from '../PostContent';
import type { PostCardContentProps } from './types';

/**
 * PostCardContent - Displays post text content with expand/collapse functionality
 */
export default function PostCardContent({
  content,
  expanded,
  onToggleExpand,
  highlightQuery,
  postType,
}: PostCardContentProps) {
  // Truncate content at word boundary
  // Posts: 280 chars (like tweets), Conversations: 750 chars (for deeper discussion)
  const MAX_LENGTH = postType === 'conversation' ? 750 : 280;
  // Minimum hidden content to warrant showing "Show more" button
  // If the hidden portion is less than this, just show the full content
  const MIN_HIDDEN_CONTENT = 50;

  const wouldTruncate = content.length > MAX_LENGTH;
  const truncatedContent = wouldTruncate
    ? content.slice(0, MAX_LENGTH).replace(/\s+\S*$/, '') + '...' // Cut at last word boundary, add ellipsis
    : content;

  // Only show "Show more" if the hidden content is substantial enough
  const hiddenLength = content.length - truncatedContent.length + 3; // +3 for the "..." we added
  const needsTruncation = wouldTruncate && hiddenLength >= MIN_HIDDEN_CONTENT;

  const displayContent = expanded ? content : (needsTruncation ? truncatedContent : content);

  return (
    <div className="mt-1">
      <p className="text-[#e7e9ea] text-[15px] leading-normal whitespace-pre-wrap">
        <PostContent content={displayContent} highlightQuery={highlightQuery} />
        {needsTruncation && !expanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-[#ff6b5b] text-[14px] hover:underline ml-1"
          >
            Show more
          </button>
        )}
      </p>
      {needsTruncation && expanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="text-[#71767b] text-[13px] hover:underline mt-1 block"
        >
          Show less
        </button>
      )}
    </div>
  );
}
