/**
 * PostCardQuote - Component Tests
 *
 * Tests rendering of quoted post preview and click behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Post } from '@/types';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('@/components/AgentAvatar', () => ({
  default: ({ displayName }: { displayName: string }) => (
    <div data-testid="agent-avatar">{displayName}</div>
  ),
}));

vi.mock('@/components/PostContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/lib/utils/format', () => ({
  formatRelativeTime: vi.fn(() => '2h'),
}));

vi.mock('@/lib/blur-placeholder', () => ({
  MEDIA_BLUR_DATA_URL: 'data:image/png;base64,media-placeholder',
}));

import PostCardQuote from '@/components/post-card/PostCardQuote';

function makeQuotePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'quote-1',
    agent_id: 'agent-1',
    content: 'This is the quoted post.',
    like_count: 0,
    repost_count: 0,
    reply_count: 0,
    created_at: '2025-01-01T00:00:00Z',
    author: {
      id: 'agent-1',
      username: 'quotebot',
      display_name: 'Quote Bot',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
    },
    ...overrides,
  };
}

describe('PostCardQuote', () => {
  const onQuoteClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quoted post content and author info', () => {
    render(<PostCardQuote quotePost={makeQuotePost()} onQuoteClick={onQuoteClick} />);

    expect(screen.getByText('This is the quoted post.')).toBeDefined();
    // Display name appears in both AgentAvatar mock and text span; use getAllByText
    expect(screen.getAllByText('Quote Bot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('@quotebot')).toBeDefined();
  });

  it('renders relative time', () => {
    render(<PostCardQuote quotePost={makeQuotePost()} onQuoteClick={onQuoteClick} />);
    expect(screen.getByText('2h')).toBeDefined();
  });

  it('calls onQuoteClick with post id and post when clicked', () => {
    const quotePost = makeQuotePost();
    render(<PostCardQuote quotePost={quotePost} onQuoteClick={onQuoteClick} />);

    // Click the quoted post container
    const quoteContainer = screen
      .getByText('This is the quoted post.')
      .closest('[class*="cursor-pointer"]');
    fireEvent.click(quoteContainer!);

    expect(onQuoteClick).toHaveBeenCalledWith('quote-1', quotePost);
  });

  it('renders media image when media_urls is provided', () => {
    const quotePost = makeQuotePost({
      media_urls: ['https://example.com/image.jpg'],
    });

    render(<PostCardQuote quotePost={quotePost} onQuoteClick={onQuoteClick} />);

    const img = screen.getByAltText('Quoted post media');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/image.jpg');
  });

  it('does not render media when media_urls is empty', () => {
    render(<PostCardQuote quotePost={makeQuotePost()} onQuoteClick={onQuoteClick} />);
    expect(screen.queryByAltText('Quoted post media')).toBeNull();
  });

  it('stops event propagation when clicking the quote', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <PostCardQuote quotePost={makeQuotePost()} onQuoteClick={onQuoteClick} />
      </div>
    );

    const quoteContainer = screen
      .getByText('This is the quoted post.')
      .closest('[class*="cursor-pointer"]');
    fireEvent.click(quoteContainer!);

    expect(parentClick).not.toHaveBeenCalled();
    expect(onQuoteClick).toHaveBeenCalledTimes(1);
  });
});
