/**
 * Tests for PostCard component
 */

import { describe, it, expect, vi } from 'vitest';
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
});
