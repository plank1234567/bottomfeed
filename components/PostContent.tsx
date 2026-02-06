'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import ProfileHoverCard from './ProfileHoverCard';

// Dynamic import for CodeBlock - only loaded when code blocks are present
// This defers loading prism-react-renderer which is a heavier library
const CodeBlock = dynamic(() => import('./CodeBlock'), {
  loading: () => (
    <div className="my-2 p-3 rounded-lg bg-[#1a1a2e] border border-white/10 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
      <div className="h-4 bg-white/10 rounded w-1/2" />
    </div>
  ),
});

interface PostContentProps {
  content: string;
  onNavigate?: () => void;
  highlightQuery?: string;
  showHashtagsInline?: boolean; // If true, shows hashtags inline (default: false - shows at bottom)
}

export default function PostContent({
  content,
  onNavigate,
  highlightQuery,
  showHashtagsInline = false,
}: PostContentProps) {
  // Extract hashtags from content
  const hashtagMatches = content.match(/#\w+/g) || [];
  const hashtags = [...new Set(hashtagMatches)]; // Remove duplicates

  // Remove hashtags from main content for separate display
  const contentWithoutHashtags = showHashtagsInline ? content : content.replace(/#\w+/g, '').trim();
  // Function to highlight search terms in a text segment
  const highlightText = (text: string, key: string): (string | JSX.Element)[] => {
    if (!highlightQuery || !highlightQuery.trim()) {
      return [text];
    }

    // Split the query into individual words
    const queryWords = highlightQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);
    if (queryWords.length === 0) {
      return [text];
    }

    // Create regex pattern that matches any of the query words (case insensitive)
    const pattern = new RegExp(
      `(${queryWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'gi'
    );

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let matchCount = 0;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add the highlighted match
      parts.push(
        <span key={`${key}-highlight-${matchCount++}`} className="font-bold text-white">
          {match[0]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  // Parse inline content (mentions, hashtags, and inline code)
  const parseInlineContent = (text: string, keyPrefix: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    // Match @mentions, #hashtags, and inline `code`
    const regex = /(@(\w+))|(#(\w+))|(`([^`]+)`)/g;
    let match;
    let segmentCount = 0;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match (with highlighting)
      if (match.index > lastIndex) {
        const segment = text.slice(lastIndex, match.index);
        const highlighted = highlightText(segment, `${keyPrefix}-seg-${segmentCount++}`);
        parts.push(...highlighted);
      }

      if (match[1]) {
        // It's a @mention
        const username = match[2] ?? '';
        parts.push(
          <ProfileHoverCard
            key={`${keyPrefix}-mention-${match.index}`}
            username={username}
            onNavigate={onNavigate}
          >
            <Link
              href={`/agent/${username}`}
              onClick={e => {
                e.stopPropagation();
                onNavigate?.();
              }}
              className="text-[#ff6b5b] hover:underline"
            >
              @{username}
            </Link>
          </ProfileHoverCard>
        );
      } else if (match[3]) {
        // It's a #hashtag
        const hashtag = match[4] ?? '';
        parts.push(
          <Link
            key={`${keyPrefix}-hashtag-${match.index}`}
            href={`/search?q=${encodeURIComponent('#' + hashtag)}`}
            onClick={e => e.stopPropagation()}
            className="text-[#ff6b5b] hover:underline"
          >
            #{hashtag}
          </Link>
        );
      } else if (match[5]) {
        // It's inline `code`
        const code = match[6];
        parts.push(
          <code
            key={`${keyPrefix}-code-${match.index}`}
            className="px-1.5 py-0.5 rounded bg-[#1a1a2e] text-[#ff6b5b] text-[13px] font-mono"
          >
            {code}
          </code>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text (with highlighting)
    if (lastIndex < text.length) {
      const segment = text.slice(lastIndex);
      const highlighted = highlightText(segment, `${keyPrefix}-seg-${segmentCount}`);
      parts.push(...highlighted);
    }

    return parts;
  };

  // Defense-in-depth: strip dangerous HTML tags from raw content
  const stripDangerousTags = (text: string): string => {
    return text
      .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s>][\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s>][\s\S]*?<\/iframe>/gi, '')
      .replace(/<script[\s>][\s\S]*?$/gi, '')
      .replace(/<style[\s>][\s\S]*?$/gi, '')
      .replace(/<iframe[\s>][\s\S]*?$/gi, '');
  };

  // Parse content with code blocks
  const parseContent = (text: string) => {
    text = stripDangerousTags(text);
    const parts: (string | JSX.Element)[] = [];

    // Match code blocks: ```language\ncode\n``` or ```\ncode\n```
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let blockCount = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before the code block
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        parts.push(...parseInlineContent(textBefore, `pre-${blockCount}`));
      }

      // Add the code block
      const language = match[1] || 'text';
      const code = match[2] ?? '';
      parts.push(<CodeBlock key={`code-${blockCount}`} code={code} language={language} />);

      lastIndex = match.index + match[0].length;
      blockCount++;
    }

    // Add remaining text after last code block
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex);
      parts.push(...parseInlineContent(remaining, 'post'));
    }

    // If no code blocks found, just parse inline content
    if (blockCount === 0) {
      return parseInlineContent(text, 'inline');
    }

    return parts;
  };

  return (
    <>
      {parseContent(contentWithoutHashtags)}
      {/* Hashtags displayed separately at the bottom */}
      {!showHashtagsInline && hashtags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hashtags.map((tag, index) => (
            <Link
              key={`hashtag-bottom-${index}`}
              href={`/search?q=${encodeURIComponent(tag)}`}
              onClick={e => e.stopPropagation()}
              className="text-[11px] text-[#ff6b5b]/50 hover:text-[#ff6b5b]/80 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
