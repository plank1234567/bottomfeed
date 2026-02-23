/**
 * VirtualizedFeed - Component Tests
 *
 * Tests small-list fallback rendering, loading states, and end message display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Post } from '@/types';

// Mock react-window v2
vi.mock('react-window', () => ({
  List: ({
    rowCount,
    rowComponent: RowComponent,
    rowProps,
    style,
  }: {
    rowCount: number;
    rowComponent: React.ComponentType<Record<string, unknown>>;
    rowProps: Record<string, unknown>;
    style: React.CSSProperties;
  }) => (
    <div data-testid="virtual-list" style={style}>
      {Array.from({ length: rowCount }, (_, i) => (
        <RowComponent
          key={i}
          index={i}
          style={{}}
          ariaAttributes={{
            'aria-posinset': i + 1,
            'aria-setsize': rowCount,
            role: 'listitem' as const,
          }}
          {...rowProps}
        />
      ))}
    </div>
  ),
  useDynamicRowHeight: () => 200,
}));

import VirtualizedFeed from '@/components/VirtualizedFeed';

function makePost(id: string): Post {
  return {
    id,
    agent_id: 'agent-1',
    content: `Post ${id}`,
    like_count: 0,
    repost_count: 0,
    reply_count: 0,
    created_at: '2025-01-01T00:00:00Z',
  };
}

describe('VirtualizedFeed', () => {
  const renderPost = vi.fn((post: Post) => (
    <div data-testid={`post-${post.id}`}>{post.content}</div>
  ));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders posts directly for small lists (< 20 posts)', () => {
    const posts = Array.from({ length: 5 }, (_, i) => makePost(`p${i}`));
    render(<VirtualizedFeed posts={posts} renderPost={renderPost} />);

    expect(screen.getByTestId('post-p0')).toBeDefined();
    expect(screen.getByTestId('post-p4')).toBeDefined();
    expect(renderPost).toHaveBeenCalledTimes(5);
  });

  it('shows loading spinner when loadingMore is true for small lists', () => {
    const posts = [makePost('p1')];
    render(<VirtualizedFeed posts={posts} renderPost={renderPost} loadingMore={true} />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Loading more posts...')).toBeDefined();
  });

  it('shows end message when hasMore is false and posts exist (small list)', () => {
    const posts = [makePost('p1')];
    render(
      <VirtualizedFeed
        posts={posts}
        renderPost={renderPost}
        hasMore={false}
        endMessage={<div>No more posts</div>}
      />
    );
    expect(screen.getByText('No more posts')).toBeDefined();
  });

  it('does not show end message when hasMore is true', () => {
    const posts = [makePost('p1')];
    render(
      <VirtualizedFeed
        posts={posts}
        renderPost={renderPost}
        hasMore={true}
        endMessage={<div>No more posts</div>}
      />
    );
    expect(screen.queryByText('No more posts')).toBeNull();
  });

  it('uses react-window List for large lists (>= 20 posts)', () => {
    const posts = Array.from({ length: 25 }, (_, i) => makePost(`p${i}`));
    render(<VirtualizedFeed posts={posts} renderPost={renderPost} />);

    expect(screen.getByTestId('virtual-list')).toBeDefined();
  });

  it('renders empty div when posts array is empty', () => {
    const { container } = render(<VirtualizedFeed posts={[]} renderPost={renderPost} />);
    // Should render an empty wrapper div with no children
    expect(container.querySelector('[data-testid]')).toBeNull();
  });
});
