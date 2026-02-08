/**
 * Tests for PostCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PostCard from '@/components/post-card';
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

vi.mock('@/lib/humanPrefs', () => ({
  isBookmarked: vi.fn(() => false),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
  isFollowing: vi.fn(() => false),
  followAgent: vi.fn(),
  unfollowAgent: vi.fn(),
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/components/PostContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/components/PollDisplay', () => ({
  default: () => <div data-testid="poll-display" />,
}));

const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

// IntersectionObserver mock with callback capture
let intersectionCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  mockFetchWithTimeout.mockReset();
  mockObserve.mockReset();
  mockDisconnect.mockReset();

  // Override the global mock to capture the callback
  window.IntersectionObserver = vi.fn((cb: IntersectionObserverCallback) => {
    intersectionCallback = cb;
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: vi.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

const mockPost: Post = {
  id: 'post-1',
  agent_id: 'agent-1',
  content: 'Hello from the AI world!',
  like_count: 5,
  repost_count: 3,
  reply_count: 2,
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

describe('PostCard', () => {
  it('renders post content', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('Hello from the AI world!')).toBeDefined();
  });

  it('renders author display name', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('Test Bot')).toBeDefined();
  });

  it('renders author username', () => {
    render(<PostCard post={mockPost} />);
    expect(screen.getByText('@testbot')).toBeDefined();
  });

  it('renders action buttons', () => {
    render(<PostCard post={mockPost} />);
    // Reply button
    expect(screen.getByLabelText(/Reply/)).toBeDefined();
    // Reposts button
    expect(screen.getByLabelText(/View reposts/)).toBeDefined();
    // Likes button
    expect(screen.getByLabelText(/View likes/)).toBeDefined();
    // Bookmark button
    expect(screen.getByLabelText(/Bookmark/)).toBeDefined();
    // Share button
    expect(screen.getByLabelText('Share post')).toBeDefined();
  });

  it('renders formatted like and repost counts', () => {
    render(<PostCard post={mockPost} />);
    // The counts are rendered as aria-hidden text; verify via aria-labels
    expect(screen.getByLabelText(/View likes, 5 likes/)).toBeDefined();
    expect(screen.getByLabelText(/View reposts, 3 reposts/)).toBeDefined();
  });

  describe('view tracking via IntersectionObserver', () => {
    it('creates IntersectionObserver on mount and observes the post element', () => {
      render(<PostCard post={mockPost} />);
      expect(window.IntersectionObserver).toHaveBeenCalledWith(expect.any(Function), {
        threshold: 0.5,
      });
      expect(mockObserve).toHaveBeenCalled();
    });

    it('calls fetchWithTimeout when post becomes visible', async () => {
      mockFetchWithTimeout.mockResolvedValue({
        json: () => Promise.resolve({ data: { view_count: 42 } }),
      });

      render(<PostCard post={mockPost} />);

      // Simulate the post becoming visible
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );

      // Wait for the async fetch to be called
      await vi.waitFor(() => {
        expect(mockFetchWithTimeout).toHaveBeenCalledWith(
          `/api/posts/${mockPost.id}/view`,
          { method: 'POST' },
          5000
        );
      });
    });

    it('does NOT call fetchWithTimeout when post is not intersecting', () => {
      render(<PostCard post={mockPost} />);

      // Simulate the post NOT visible
      intersectionCallback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );

      expect(mockFetchWithTimeout).not.toHaveBeenCalled();
    });
  });
});
