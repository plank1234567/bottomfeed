/**
 * Tests for PostModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PostModal from '@/components/PostModal';
import type { Post } from '@/types';

// Mock dependencies
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
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

vi.mock('@/components/post-modal', () => ({
  PostModalHeader: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose} data-testid="modal-header-close">
      Close
    </button>
  ),
  ReplyCard: ({ reply }: { reply: Post }) => <div data-testid="reply-card">{reply.content}</div>,
}));

vi.mock('@/lib/humanPrefs', () => ({
  isBookmarked: vi.fn(() => false),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  getInitials: vi.fn((name: string) => name?.slice(0, 2).toUpperCase() || 'AI'),
  formatFullDate: vi.fn(() => 'Jan 1, 2025'),
  formatCount: vi.fn((n: number) => String(n)),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeUrl: vi.fn((url: string) => url),
}));

const mockPost: Post = {
  id: 'post-1',
  agent_id: 'agent-1',
  content: 'Hello from PostModal!',
  like_count: 10,
  repost_count: 5,
  reply_count: 2,
  view_count: 100,
  created_at: '2025-01-01T00:00:00Z',
  author: {
    id: 'agent-1',
    username: 'testbot',
    display_name: 'Test Bot',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
  },
};

const mockApiResponse = {
  data: {
    post: mockPost,
    replies: [],
  },
};

describe('PostModal', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as Response);
  });

  it('renders with role="dialog" and aria-modal="true"', () => {
    const onClose = vi.fn();
    render(<PostModal postId="post-1" onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('shows loading state initially', () => {
    const onClose = vi.fn();
    render(<PostModal postId="post-1" onClose={onClose} />);

    expect(screen.getByRole('status', { name: 'Loading post' })).toBeDefined();
  });

  it('renders post content after data loads', async () => {
    const onClose = vi.fn();
    render(<PostModal postId="post-1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Hello from PostModal!')).toBeDefined();
    });
  });

  it('renders author info after data loads', async () => {
    const onClose = vi.fn();
    render(<PostModal postId="post-1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Test Bot')).toBeDefined();
      expect(screen.getByText('@testbot')).toBeDefined();
    });
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<PostModal postId="post-1" onClose={onClose} />);

    // The backdrop has aria-hidden="true" so we target it directly
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<PostModal postId="post-1" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "Post not found" when fetch fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const onClose = vi.fn();
    render(<PostModal postId="bad-id" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Post not found')).toBeDefined();
    });
  });

  it('renders action buttons after post loads', async () => {
    const onClose = vi.fn();
    render(<PostModal postId="post-1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText('View reposts')).toBeDefined();
      expect(screen.getByLabelText('View likes')).toBeDefined();
      expect(screen.getByLabelText(/Bookmark/)).toBeDefined();
      expect(screen.getByLabelText('Share post')).toBeDefined();
    });
  });
});
