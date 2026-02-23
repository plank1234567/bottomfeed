/**
 * PostActions - Component Tests
 *
 * Tests action button rendering, click handlers, share menu toggle,
 * and bookmark state display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PostActions from '@/components/post/PostActions';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils/format', () => ({
  formatCount: vi.fn((n: number) => String(n)),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultProps = {
  postId: 'post-123',
  likeCount: 5,
  repostCount: 3,
  replyCount: 2,
  viewCount: 100,
  isBookmarked: false,
  onLike: vi.fn(),
  onRepost: vi.fn(),
  onReply: vi.fn(),
  onBookmark: vi.fn(),
  onViewLikes: vi.fn(),
  onViewReposts: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all action buttons', () => {
    render(<PostActions {...defaultProps} />);
    expect(screen.getByTitle('Bookmark')).toBeDefined();
    expect(screen.getByTitle('Share')).toBeDefined();
  });

  it('displays counts when greater than zero', () => {
    render(<PostActions {...defaultProps} />);
    expect(screen.getByText('2')).toBeDefined(); // reply count
    expect(screen.getByText('3')).toBeDefined(); // repost count
    expect(screen.getByText('5')).toBeDefined(); // like count
    expect(screen.getByText('100')).toBeDefined(); // view count
  });

  it('does not display counts when zero', () => {
    render(
      <PostActions {...defaultProps} likeCount={0} repostCount={0} replyCount={0} viewCount={0} />
    );
    // No count text should be visible
    expect(screen.queryByText('0')).toBeNull();
  });

  it('calls onReply when reply button is clicked', () => {
    const onReply = vi.fn();
    render(<PostActions {...defaultProps} onReply={onReply} />);
    // Reply button is the first button in the component
    const buttons = screen.getAllByRole('button');
    // The first button is the reply button
    fireEvent.click(buttons[0]!);
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it('calls onBookmark when bookmark button is clicked', () => {
    const onBookmark = vi.fn();
    render(<PostActions {...defaultProps} onBookmark={onBookmark} />);
    fireEvent.click(screen.getByTitle('Bookmark'));
    expect(onBookmark).toHaveBeenCalledTimes(1);
  });

  it('shows "Remove bookmark" title when bookmarked', () => {
    render(<PostActions {...defaultProps} isBookmarked={true} />);
    expect(screen.getByTitle('Remove bookmark')).toBeDefined();
  });

  it('toggles share menu when share button is clicked', () => {
    render(<PostActions {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Share'));
    expect(screen.getByText('Copy link')).toBeDefined();
  });
});
