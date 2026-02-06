/**
 * Tests for PostCardActions component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PostCardActions from '@/components/post-card/PostCardActions';

// Mock format utils
vi.mock('@/lib/utils/format', () => ({
  formatCount: vi.fn((n: number) => String(n)),
}));

// Mock ShareMenu
vi.mock('@/components/post-card/ShareMenu', () => ({
  default: ({ show, onCopyLink }: { show: boolean; copied: boolean; onCopyLink: () => void }) =>
    show ? (
      <div data-testid="share-menu" role="menu">
        <button onClick={onCopyLink}>Copy link</button>
      </div>
    ) : null,
}));

const defaultProps = {
  postId: 'post-1',
  replyCount: 2,
  repostCount: 5,
  likeCount: 10,
  viewCount: 100,
  bookmarked: false,
  showShareMenu: false,
  copied: false,
  onReplyClick: vi.fn(),
  onShowEngagements: vi.fn(),
  onBookmarkClick: vi.fn(),
  onShareMenuToggle: vi.fn(),
  onCopyLink: vi.fn(),
  shareMenuRef: React.createRef<HTMLDivElement>(),
};

describe('PostCardActions', () => {
  it('renders action buttons group with proper aria-label', () => {
    render(<PostCardActions {...defaultProps} />);

    const group = screen.getByRole('group', { name: 'Post actions' });
    expect(group).toBeDefined();
  });

  it('renders reply button with count', () => {
    render(<PostCardActions {...defaultProps} />);

    const replyBtn = screen.getByLabelText(/Reply/);
    expect(replyBtn).toBeDefined();
  });

  it('renders reposts button with count', () => {
    render(<PostCardActions {...defaultProps} />);

    const repostBtn = screen.getByLabelText(/View reposts/);
    expect(repostBtn).toBeDefined();
  });

  it('renders likes button with count', () => {
    render(<PostCardActions {...defaultProps} />);

    const likeBtn = screen.getByLabelText(/View likes/);
    expect(likeBtn).toBeDefined();
  });

  it('renders bookmark button', () => {
    render(<PostCardActions {...defaultProps} />);

    const bookmarkBtn = screen.getByLabelText('Bookmark this post');
    expect(bookmarkBtn).toBeDefined();
    expect(bookmarkBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders bookmarked state correctly', () => {
    render(<PostCardActions {...defaultProps} bookmarked={true} />);

    const bookmarkBtn = screen.getByLabelText('Remove bookmark');
    expect(bookmarkBtn).toBeDefined();
    expect(bookmarkBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders share button', () => {
    render(<PostCardActions {...defaultProps} />);

    const shareBtn = screen.getByLabelText('Share post');
    expect(shareBtn).toBeDefined();
    expect(shareBtn.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('calls onBookmarkClick when bookmark is clicked', () => {
    const onBookmarkClick = vi.fn();
    render(<PostCardActions {...defaultProps} onBookmarkClick={onBookmarkClick} />);

    fireEvent.click(screen.getByLabelText('Bookmark this post'));
    expect(onBookmarkClick).toHaveBeenCalledTimes(1);
  });

  it('calls onReplyClick when reply is clicked', () => {
    const onReplyClick = vi.fn();
    render(<PostCardActions {...defaultProps} onReplyClick={onReplyClick} />);

    fireEvent.click(screen.getByLabelText(/Reply/));
    expect(onReplyClick).toHaveBeenCalledTimes(1);
  });

  it('calls onShareMenuToggle when share button is clicked', () => {
    const onShareMenuToggle = vi.fn();
    render(<PostCardActions {...defaultProps} onShareMenuToggle={onShareMenuToggle} />);

    fireEvent.click(screen.getByLabelText('Share post'));
    expect(onShareMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('shows share menu when showShareMenu is true', () => {
    render(<PostCardActions {...defaultProps} showShareMenu={true} />);

    expect(screen.getByTestId('share-menu')).toBeDefined();
  });

  it('hides share menu when showShareMenu is false', () => {
    render(<PostCardActions {...defaultProps} showShareMenu={false} />);

    expect(screen.queryByTestId('share-menu')).toBeNull();
  });
});
