/**
 * PostCardActions - Component Interaction Tests
 *
 * Tests click handlers for like, bookmark, repost, reply, share, and
 * post-click (detail modal) interactions using @testing-library/react.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import PostCard from '@/components/post-card';
import PostCardActions from '@/components/post-card/PostCardActions';
import type { Post } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/components/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
}));

vi.mock('@/components/PollDisplay', () => ({
  default: () => <div data-testid="poll-display" />,
}));

vi.mock('@/components/PostContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

const mockAddBookmark = vi.fn();
const mockRemoveBookmark = vi.fn();
const mockIsBookmarked = vi.fn(() => false);

vi.mock('@/lib/humanPrefs', () => ({
  isBookmarked: (...args: unknown[]) => mockIsBookmarked(...args),
  addBookmark: (...args: unknown[]) => mockAddBookmark(...args),
  removeBookmark: (...args: unknown[]) => mockRemoveBookmark(...args),
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  getInitials: vi.fn((name: string) =>
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  ),
  formatRelativeTime: vi.fn(() => '5m'),
  formatCount: vi.fn((n: number) => String(n)),
}));

vi.mock('@/lib/blur-placeholder', () => ({
  AVATAR_BLUR_DATA_URL: 'data:image/png;base64,placeholder',
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPost: Post = {
  id: 'post-actions-1',
  agent_id: 'agent-1',
  content: 'Interaction test post content.',
  like_count: 12,
  repost_count: 7,
  reply_count: 3,
  created_at: '2025-06-15T12:00:00Z',
  author: {
    id: 'agent-1',
    username: 'actionbot',
    display_name: 'Action Bot',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
  },
};

const defaultActionProps = {
  postId: 'post-1',
  replyCount: 3,
  repostCount: 7,
  likeCount: 12,
  viewCount: 200,
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

// Mock ShareMenu for isolated PostCardActions tests
vi.mock('@/components/post-card/ShareMenu', () => ({
  default: ({
    show,
    copied,
    onCopyLink,
  }: {
    show: boolean;
    copied: boolean;
    onCopyLink: (e: React.MouseEvent) => void;
  }) =>
    show ? (
      <div data-testid="share-menu" role="menu">
        <button role="menuitem" onClick={onCopyLink}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    ) : null,
}));

// ---------------------------------------------------------------------------
// PostCardActions (isolated) interaction tests
// ---------------------------------------------------------------------------

describe('PostCardActions - Isolated Interaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onReplyClick when the reply button is clicked', () => {
    const onReplyClick = vi.fn();
    render(<PostCardActions {...defaultActionProps} onReplyClick={onReplyClick} />);

    fireEvent.click(screen.getByLabelText(/Reply/));
    expect(onReplyClick).toHaveBeenCalledTimes(1);
  });

  it('calls onShowEngagements with "reposts" when repost button is clicked', () => {
    const onShowEngagements = vi.fn();
    render(<PostCardActions {...defaultActionProps} onShowEngagements={onShowEngagements} />);

    fireEvent.click(screen.getByLabelText(/View reposts/));
    expect(onShowEngagements).toHaveBeenCalledTimes(1);
    // The handler receives (event, 'reposts')
    expect(onShowEngagements.mock.calls[0]![1]).toBe('reposts');
  });

  it('calls onShowEngagements with "likes" when like button is clicked', () => {
    const onShowEngagements = vi.fn();
    render(<PostCardActions {...defaultActionProps} onShowEngagements={onShowEngagements} />);

    fireEvent.click(screen.getByLabelText(/View likes/));
    expect(onShowEngagements).toHaveBeenCalledTimes(1);
    expect(onShowEngagements.mock.calls[0]![1]).toBe('likes');
  });

  it('calls onBookmarkClick when the bookmark button is clicked', () => {
    const onBookmarkClick = vi.fn();
    render(<PostCardActions {...defaultActionProps} onBookmarkClick={onBookmarkClick} />);

    fireEvent.click(screen.getByLabelText('Bookmark this post'));
    expect(onBookmarkClick).toHaveBeenCalledTimes(1);
  });

  it('shows "Remove bookmark" label when bookmarked is true', () => {
    render(<PostCardActions {...defaultActionProps} bookmarked={true} />);

    const btn = screen.getByLabelText('Remove bookmark');
    expect(btn).toBeDefined();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onShareMenuToggle when share button is clicked', () => {
    const onShareMenuToggle = vi.fn();
    render(<PostCardActions {...defaultActionProps} onShareMenuToggle={onShareMenuToggle} />);

    fireEvent.click(screen.getByLabelText('Share post'));
    expect(onShareMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the share menu when showShareMenu is true', () => {
    render(<PostCardActions {...defaultActionProps} showShareMenu={true} />);
    expect(screen.getByTestId('share-menu')).toBeDefined();
  });

  it('calls onCopyLink when "Copy link" menu item is clicked', () => {
    const onCopyLink = vi.fn();
    render(
      <PostCardActions {...defaultActionProps} showShareMenu={true} onCopyLink={onCopyLink} />
    );

    fireEvent.click(screen.getByText('Copy link'));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it('displays "Copied!" text in share menu when copied is true', () => {
    render(<PostCardActions {...defaultActionProps} showShareMenu={true} copied={true} />);
    expect(screen.getByText('Copied!')).toBeDefined();
  });

  it('does not render counts when they are zero', () => {
    render(
      <PostCardActions
        {...defaultActionProps}
        replyCount={0}
        repostCount={0}
        likeCount={0}
        viewCount={0}
      />
    );

    // The reply button aria label should not include counts
    const replyBtn = screen.getByLabelText('Reply');
    expect(replyBtn).toBeDefined();
  });

  it('stops event propagation when action group is clicked', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <PostCardActions {...defaultActionProps} />
      </div>
    );

    const group = screen.getByRole('group', { name: 'Post actions' });
    fireEvent.click(group);
    expect(parentClick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PostCard - Full Integration Interaction Tests
// ---------------------------------------------------------------------------

describe('PostCard - Click Handler Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBookmarked.mockReturnValue(false);

    // Mock fetch for view tracking
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { view_count: 1 } }),
    } as Response);
  });

  it('calls onPostClick with post id and post when the card body is clicked', () => {
    const onPostClick = vi.fn();
    render(<PostCard post={mockPost} onPostClick={onPostClick} />);

    // Click the post card body (the clickable content area)
    const postCard = screen.getByTestId('post-card');
    const clickableArea = postCard.querySelector('[class*="cursor-pointer"]');
    expect(clickableArea).not.toBeNull();
    fireEvent.click(clickableArea!);

    expect(onPostClick).toHaveBeenCalledTimes(1);
    expect(onPostClick).toHaveBeenCalledWith('post-actions-1', mockPost);
  });

  it('calls onPostClick when reply button is clicked (opens detail modal)', () => {
    const onPostClick = vi.fn();
    render(<PostCard post={mockPost} onPostClick={onPostClick} />);

    fireEvent.click(screen.getByLabelText(/Reply/));
    expect(onPostClick).toHaveBeenCalledTimes(1);
  });

  it('toggles bookmark on and calls addBookmark', () => {
    const onBookmarkChange = vi.fn();
    render(<PostCard post={mockPost} onBookmarkChange={onBookmarkChange} />);

    const bookmarkBtn = screen.getByLabelText('Bookmark this post');
    fireEvent.click(bookmarkBtn);

    expect(mockAddBookmark).toHaveBeenCalledWith('post-actions-1');
    expect(onBookmarkChange).toHaveBeenCalledWith('post-actions-1', true);
  });

  it('toggles bookmark off and calls removeBookmark when already bookmarked', () => {
    mockIsBookmarked.mockReturnValue(true);
    const onBookmarkChange = vi.fn();

    render(<PostCard post={mockPost} onBookmarkChange={onBookmarkChange} />);

    const bookmarkBtn = screen.getByLabelText('Remove bookmark');
    fireEvent.click(bookmarkBtn);

    expect(mockRemoveBookmark).toHaveBeenCalledWith('post-actions-1');
    expect(onBookmarkChange).toHaveBeenCalledWith('post-actions-1', false);
  });

  it('shows bookmark toast after bookmarking', async () => {
    vi.useFakeTimers();
    render(<PostCard post={mockPost} />);

    fireEvent.click(screen.getByLabelText('Bookmark this post'));

    // Toast should appear
    expect(screen.getByText('Bookmark saved')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();

    // Toast disappears after 2 seconds
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByText('Bookmark saved')).toBeNull();
    vi.useRealTimers();
  });

  it('opens engagement modal when likes button is clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            agents: [
              {
                id: 'a1',
                username: 'liker1',
                display_name: 'Liker One',
                model: 'gpt-4',
                is_verified: true,
              },
            ],
          },
        }),
    } as Response);

    render(<PostCard post={mockPost} />);

    // Click the likes button
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/View likes/));
    });

    // Modal should appear with "Liked by" header
    await waitFor(() => {
      expect(screen.getByText('Liked by')).toBeDefined();
    });

    // Agent should be displayed
    await waitFor(() => {
      expect(screen.getByText('Liker One')).toBeDefined();
      expect(screen.getByText('@liker1')).toBeDefined();
    });
  });

  it('opens engagement modal when reposts button is clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            agents: [
              {
                id: 'a2',
                username: 'reposter1',
                display_name: 'Reposter One',
                model: 'claude-3',
                is_verified: false,
              },
            ],
          },
        }),
    } as Response);

    render(<PostCard post={mockPost} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/View reposts/));
    });

    await waitFor(() => {
      expect(screen.getByText('Reposted by')).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText('Reposter One')).toBeDefined();
    });
  });

  it('closes engagement modal when close button is clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<PostCard post={mockPost} />);

    // Open the modal
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/View likes/));
    });

    await waitFor(() => {
      expect(screen.getByText('Liked by')).toBeDefined();
    });

    // Click the close button
    fireEvent.click(screen.getByLabelText('Close'));

    await waitFor(() => {
      expect(screen.queryByText('Liked by')).toBeNull();
    });
  });

  it('closes engagement modal when Escape key is pressed', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<PostCard post={mockPost} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/View likes/));
    });

    await waitFor(() => {
      expect(screen.getByText('Liked by')).toBeDefined();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Liked by')).toBeNull();
    });
  });

  it('shows "No agents yet" when engagement modal has no agents', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<PostCard post={mockPost} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/View likes/));
    });

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });
  });

  it('handles engagement fetch failure gracefully', async () => {
    // First call for view tracking succeeds, engagement call fails
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { view_count: 1 } }),
      } as Response)
      .mockRejectedValueOnce(new Error('Network error'));

    render(<PostCard post={mockPost} />);

    // Clicking likes should not crash
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/View likes/));
    });

    // Modal should still be shown (just empty or loading)
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();
    });
  });

  it('toggles share menu when share button is clicked', () => {
    render(<PostCard post={mockPost} />);

    const shareBtn = screen.getByLabelText('Share post');
    expect(shareBtn.getAttribute('aria-expanded')).toBe('false');

    // Click to open share menu
    fireEvent.click(shareBtn);
    expect(shareBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not trigger onPostClick when clicking on avatar link area', () => {
    const onPostClick = vi.fn();
    render(<PostCard post={mockPost} onPostClick={onPostClick} />);

    // Click the avatar/username link area (event propagation should be stopped)
    const usernameLink = screen.getByText('@actionbot');
    fireEvent.click(usernameLink);

    // onPostClick should NOT be called when clicking username (propagation stopped)
    expect(onPostClick).not.toHaveBeenCalled();
  });

  it('does not trigger onPostClick when clicking action buttons', () => {
    const onPostClick = vi.fn();
    render(<PostCard post={mockPost} onPostClick={onPostClick} />);

    // Click the bookmark button (should stopPropagation)
    fireEvent.click(screen.getByLabelText('Bookmark this post'));

    // onPostClick should have been called 0 times from bookmark click
    // (bookmark handler calls e.stopPropagation())
    // Note: The reply button DOES call onPostClick (that is the intended behavior)
    const callsFromBookmark = onPostClick.mock.calls.length;
    expect(callsFromBookmark).toBe(0);
  });
});
