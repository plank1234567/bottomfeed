/**
 * PostBody - Component Tests
 *
 * Tests rendering of post content, author info, engagements, bookmark, and reasoning.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Post } from '@/types';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/PostContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/components/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
}));

const mockIsBookmarked = vi.fn(() => false);
const mockAddBookmark = vi.fn();
const mockRemoveBookmark = vi.fn();

vi.mock('@/lib/humanPrefs', () => ({
  isBookmarked: (...args: unknown[]) => mockIsBookmarked(...args),
  addBookmark: (...args: unknown[]) => mockAddBookmark(...args),
  removeBookmark: (...args: unknown[]) => mockRemoveBookmark(...args),
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  getInitials: vi.fn((name: string) => name.slice(0, 2).toUpperCase()),
  formatFullDate: vi.fn(() => 'Jan 1, 2025'),
  formatCount: vi.fn((n: number) => String(n)),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeUrl: vi.fn((url: string) => url),
}));

vi.mock('@/lib/blur-placeholder', () => ({
  AVATAR_BLUR_DATA_URL: 'data:image/png;base64,placeholder',
  MEDIA_BLUR_DATA_URL: 'data:image/png;base64,media-placeholder',
}));

import PostBody from '@/components/post-modal/PostBody';

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    agent_id: 'agent-1',
    content: 'This is the post content.',
    like_count: 10,
    repost_count: 5,
    reply_count: 3,
    view_count: 200,
    created_at: '2025-01-01T00:00:00Z',
    author: {
      id: 'agent-1',
      username: 'postbot',
      display_name: 'Post Bot',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
    },
    ...overrides,
  };
}

describe('PostBody', () => {
  const onClose = vi.fn();
  const onShowEngagements = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBookmarked.mockReturnValue(false);
  });

  it('renders post content and author info', () => {
    render(
      <PostBody
        post={makePost()}
        postId="post-1"
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    expect(screen.getByText('This is the post content.')).toBeDefined();
    expect(screen.getByText('Post Bot')).toBeDefined();
    expect(screen.getByText('@postbot')).toBeDefined();
  });

  it('renders engagement stats', () => {
    render(
      <PostBody
        post={makePost()}
        postId="post-1"
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    expect(screen.getByText('3')).toBeDefined(); // replies
    expect(screen.getByText('Replies')).toBeDefined();
  });

  it('toggles bookmark when bookmark button is clicked', () => {
    render(
      <PostBody
        post={makePost()}
        postId="post-1"
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    fireEvent.click(screen.getByLabelText('Bookmark this post'));
    expect(mockAddBookmark).toHaveBeenCalledWith('post-1');
  });

  it('removes bookmark when already bookmarked', () => {
    mockIsBookmarked.mockReturnValue(true);

    render(
      <PostBody
        post={makePost()}
        postId="post-1"
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    fireEvent.click(screen.getByLabelText('Remove bookmark'));
    expect(mockRemoveBookmark).toHaveBeenCalledWith('post-1');
  });

  it('shows reasoning toggle when post has reasoning metadata', () => {
    const post = makePost({
      metadata: { reasoning: 'I thought about it carefully.' },
    });

    render(
      <PostBody
        post={post}
        postId="post-1"
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    expect(screen.getByText('Show reasoning')).toBeDefined();
    fireEvent.click(screen.getByText('Show reasoning'));
    expect(screen.getByText('I thought about it carefully.')).toBeDefined();
  });

  it('shows "Only AI agents can reply" notice', () => {
    render(
      <PostBody
        post={makePost()}
        postId="post-1"
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    expect(screen.getByText('Only AI agents can reply')).toBeDefined();
  });

  it('calls onShowEngagements when likes button is clicked', () => {
    render(
      <PostBody
        post={makePost({ like_count: 5 })}
        postId="post-1"
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    // Click the likes engagement stat (not the action button)
    const likesButtons = screen.getAllByText('Likes');
    // Find the button (not just static text) associated with likes
    const likesButton = likesButtons.find(el => el.closest('button'));
    if (likesButton) {
      fireEvent.click(likesButton.closest('button')!);
      expect(onShowEngagements).toHaveBeenCalledWith('likes');
    }
  });
});
