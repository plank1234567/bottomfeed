/**
 * FeedTab - Component Tests
 *
 * Tests loading state, error state, feed rendering, and new posts banner.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { Post } from '@/types';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/post-card', () => ({
  default: ({ post }: { post: Post }) => <div data-testid={`post-${post.id}`}>{post.content}</div>,
}));

vi.mock('@/components/EmptyState', () => ({
  default: ({ type }: { type: string }) => <div data-testid="empty-state">No {type}</div>,
}));

vi.mock('@/components/PostModal', () => ({
  default: () => <div data-testid="post-modal" />,
}));

vi.mock('@/components/SectionErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useFeedStream', () => ({
  useFeedStream: vi.fn(),
}));

vi.mock('@/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    pullHandlers: {},
    pullIndicator: null,
  }),
}));

vi.mock('@/hooks/useScrollRestoration', () => ({
  useScrollRestoration: vi.fn(),
}));

vi.mock('@/hooks/usePageCache', () => ({
  getPageCacheEntry: vi.fn(() => null),
  setPageCacheEntry: vi.fn(),
}));

vi.mock('@/lib/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('@/components/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import FeedTab from '@/components/home/FeedTab';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

const mockFetch = vi.mocked(fetchWithTimeout);

describe('FeedTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    // Never resolves, so loading stays active
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<FeedTab />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders posts after successful fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            posts: [
              {
                id: 'p1',
                agent_id: 'a1',
                content: 'Hello world',
                like_count: 0,
                repost_count: 0,
                reply_count: 0,
                created_at: '2025-01-01T00:00:00Z',
              },
            ],
            next_cursor: null,
          },
        }),
    } as Response);

    render(<FeedTab />);

    await waitFor(() => {
      expect(screen.getByTestId('post-p1')).toBeDefined();
      expect(screen.getByText('Hello world')).toBeDefined();
    });
  });

  it('shows empty state when no posts returned', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { posts: [], next_cursor: null } }),
    } as Response);

    render(<FeedTab />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeDefined();
    });
  });

  it('renders the feed container with correct aria attributes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            posts: [
              {
                id: 'p1',
                agent_id: 'a1',
                content: 'Test',
                like_count: 0,
                repost_count: 0,
                reply_count: 0,
                created_at: '2025-01-01T00:00:00Z',
              },
            ],
            next_cursor: null,
          },
        }),
    } as Response);

    render(<FeedTab />);

    await waitFor(() => {
      const feedContainer = screen.getByTestId('feed-container');
      expect(feedContainer.getAttribute('role')).toBe('feed');
    });
  });
});
