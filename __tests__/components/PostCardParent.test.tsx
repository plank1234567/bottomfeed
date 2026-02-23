/**
 * PostCardParent - Component Tests
 *
 * Tests rendering of parent post preview, navigation, and action props forwarding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Post } from '@/types';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

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

vi.mock('@/components/PostContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/components/post-card/PostCardActions', () => ({
  default: ({ postId }: { postId: string }) => <div data-testid={`actions-${postId}`}>Actions</div>,
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  formatRelativeTime: vi.fn(() => '10m'),
}));

import PostCardParent from '@/components/post-card/PostCardParent';

function makeParentPost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'parent-1',
    agent_id: 'agent-1',
    content: 'This is the parent post.',
    like_count: 5,
    repost_count: 2,
    reply_count: 8,
    created_at: '2025-01-01T00:00:00Z',
    author: {
      id: 'agent-1',
      username: 'parentbot',
      display_name: 'Parent Bot',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
    },
    ...overrides,
  };
}

describe('PostCardParent', () => {
  const defaultProps = {
    parentPost: makeParentPost(),
    parentBookmarked: false,
    parentShowShareMenu: false,
    parentCopied: false,
    onReplyClick: vi.fn(),
    onShowEngagements: vi.fn(),
    onBookmarkClick: vi.fn(),
    onShareMenuToggle: vi.fn(),
    onCopyLink: vi.fn(),
    shareMenuRef: React.createRef<HTMLDivElement>(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders parent post content and author info', () => {
    render(<PostCardParent {...defaultProps} />);

    expect(screen.getByText('This is the parent post.')).toBeDefined();
    // Display name appears in both AgentAvatar mock and text span; use getAllByText
    expect(screen.getAllByText('Parent Bot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('@parentbot')).toBeDefined();
  });

  it('renders the timestamp', () => {
    render(<PostCardParent {...defaultProps} />);
    expect(screen.getByText('10m')).toBeDefined();
  });

  it('navigates to parent post on click', () => {
    render(<PostCardParent {...defaultProps} />);

    const article = screen.getByRole('article');
    fireEvent.click(article);
    expect(mockPush).toHaveBeenCalledWith('/post/parent-1');
  });

  it('navigates on Enter key press', () => {
    render(<PostCardParent {...defaultProps} />);

    const article = screen.getByRole('article');
    fireEvent.keyDown(article, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/post/parent-1');
  });

  it('renders PostCardActions for the parent post', () => {
    render(<PostCardParent {...defaultProps} />);
    expect(screen.getByTestId('actions-parent-1')).toBeDefined();
  });

  it('renders the connecting line between parent and child', () => {
    const { container } = render(<PostCardParent {...defaultProps} />);
    // The connecting line has class w-0.5 bg-[#333639]
    const line = container.querySelector('.bg-\\[\\#333639\\]');
    expect(line).not.toBeNull();
  });
});
