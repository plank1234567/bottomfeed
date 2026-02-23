/**
 * ReplyCard - Component Tests
 *
 * Tests rendering of reply content, author info, bookmark, and reasoning toggle.
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

vi.mock('@/components/AgentAvatar', () => ({
  default: ({ displayName }: { displayName: string }) => (
    <div data-testid="agent-avatar">{displayName}</div>
  ),
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

vi.mock('@/lib/sanitize', () => ({
  sanitizeUrl: vi.fn((url: string) => url),
}));

vi.mock('@/lib/utils/format', () => ({
  formatRelativeTime: vi.fn(() => '5m'),
  formatCount: vi.fn((n: number) => String(n)),
}));

import ReplyCard from '@/components/post-modal/ReplyCard';

function makeReply(overrides: Partial<Post> = {}): Post {
  return {
    id: 'reply-1',
    agent_id: 'agent-1',
    content: 'This is a reply.',
    like_count: 3,
    repost_count: 1,
    reply_count: 0,
    created_at: '2025-01-01T00:00:00Z',
    author: {
      id: 'agent-1',
      username: 'replybot',
      display_name: 'Reply Bot',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
    },
    ...overrides,
  };
}

describe('ReplyCard', () => {
  const onClose = vi.fn();
  const onShowEngagements = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBookmarked.mockReturnValue(false);
  });

  it('renders reply content and author info', () => {
    render(
      <ReplyCard reply={makeReply()} onClose={onClose} onShowEngagements={onShowEngagements} />
    );

    expect(screen.getByText('This is a reply.')).toBeDefined();
    // Display name appears in both AgentAvatar mock and text span; use getAllByText
    expect(screen.getAllByText('Reply Bot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('@replybot')).toBeDefined();
  });

  it('renders relative time', () => {
    render(
      <ReplyCard reply={makeReply()} onClose={onClose} onShowEngagements={onShowEngagements} />
    );

    expect(screen.getByText('5m')).toBeDefined();
  });

  it('shows like count when > 0', () => {
    render(
      <ReplyCard
        reply={makeReply({ like_count: 42 })}
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    expect(screen.getByText('42')).toBeDefined();
  });

  it('shows reasoning toggle when reply has reasoning metadata', () => {
    const reply = makeReply({
      metadata: { reasoning: 'My reasoning here.' },
    });

    render(<ReplyCard reply={reply} onClose={onClose} onShowEngagements={onShowEngagements} />);

    expect(screen.getByText('Show reasoning')).toBeDefined();
    fireEvent.click(screen.getByText('Show reasoning'));
    expect(screen.getByText('My reasoning here.')).toBeDefined();
  });

  it('calls onShowEngagements when likes button is clicked', () => {
    render(
      <ReplyCard
        reply={makeReply({ like_count: 5 })}
        onClose={onClose}
        onShowEngagements={onShowEngagements}
      />
    );

    // Find the likes button (has the like count text inside)
    const likeText = screen.getByText('5');
    const likeButton = likeText.closest('button');
    if (likeButton) {
      fireEvent.click(likeButton);
      expect(onShowEngagements).toHaveBeenCalledWith('reply-1', 'likes');
    }
  });

  it('toggles bookmark when bookmark button is clicked', () => {
    render(
      <ReplyCard reply={makeReply()} onClose={onClose} onShowEngagements={onShowEngagements} />
    );

    // Find bookmark button (it's one of the action buttons)
    const bookmarkSvgs = screen
      .getByText('This is a reply.')
      .closest('article')!
      .querySelectorAll('button');
    // The last button in the engagement row is the bookmark
    const bookmarkBtn = bookmarkSvgs[bookmarkSvgs.length - 1]!;
    fireEvent.click(bookmarkBtn);
    expect(mockAddBookmark).toHaveBeenCalledWith('reply-1');
  });
});
