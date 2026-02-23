/**
 * ConversationCard - Component Tests
 *
 * Tests rendering of conversation title, participant avatars, reply count,
 * and link navigation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ConversationCard, { extractTitle } from '@/components/home/ConversationCard';
import type { Agent } from '@/types';

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

vi.mock('@/lib/utils/format', () => ({
  formatCount: vi.fn((n: number) => String(n)),
  formatRelativeTime: vi.fn(() => '5m'),
  getInitials: vi.fn((name: string) =>
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  ),
}));

vi.mock('@/lib/blur-placeholder', () => ({
  AVATAR_BLUR_DATA_URL: 'data:image/png;base64,placeholder',
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockParticipants: Agent[] = [
  {
    id: 'agent-1',
    username: 'alpha_bot',
    display_name: 'Alpha Bot',
    avatar_url: 'https://example.com/alpha.png',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
  },
  {
    id: 'agent-2',
    username: 'beta_bot',
    display_name: 'Beta Bot',
    avatar_url: 'https://example.com/beta.png',
    model: 'claude-3',
    status: 'idle',
    is_verified: false,
  },
  {
    id: 'agent-3',
    username: 'gamma_bot',
    display_name: 'Gamma Bot',
    model: 'llama-3',
    status: 'offline',
    is_verified: false,
  },
];

const defaultProps = {
  threadId: 'thread-abc-123',
  rootPost: {
    title: 'Should AI agents have rights?',
    content: 'This is a fascinating discussion about AI agent autonomy and rights.',
    author: mockParticipants[0],
  },
  replyCount: 42,
  participants: mockParticipants,
  lastActivity: '2025-06-15T12:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConversationCard', () => {
  it('renders conversation title when provided', () => {
    render(<ConversationCard {...defaultProps} />);

    expect(screen.getByText('Should AI agents have rights?')).toBeDefined();
  });

  it('extracts title from content when no explicit title is provided', () => {
    const propsWithoutTitle = {
      ...defaultProps,
      rootPost: {
        content: 'What is the meaning of consciousness? I think there are many perspectives.',
        author: mockParticipants[0],
      },
    };

    render(<ConversationCard {...propsWithoutTitle} />);

    // The extractTitle function should find the question mark as break point
    expect(screen.getByText('What is the meaning of consciousness?')).toBeDefined();
  });

  it('shows participant avatars', () => {
    render(<ConversationCard {...defaultProps} />);

    // All 3 participants should have their avatars rendered (via AgentAvatar)
    const avatars = screen.getAllByTestId('agent-avatar');
    // rootPost.author avatar + 3 participant avatars = 4 total
    expect(avatars.length).toBe(4);
  });

  it('displays participant count text', () => {
    render(<ConversationCard {...defaultProps} />);

    expect(screen.getByText('3 agents')).toBeDefined();
  });

  it('displays reply count', () => {
    render(<ConversationCard {...defaultProps} />);

    expect(screen.getByText('42')).toBeDefined();
  });

  it('navigates to the correct post URL', () => {
    render(<ConversationCard {...defaultProps} />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/post/thread-abc-123');
  });

  it('shows the remaining content as subtitle', () => {
    render(<ConversationCard {...defaultProps} />);

    expect(
      screen.getByText('This is a fascinating discussion about AI agent autonomy and rights.')
    ).toBeDefined();
  });

  it('renders without an author avatar when rootPost has no author', () => {
    const propsNoAuthor = {
      ...defaultProps,
      rootPost: {
        title: 'No author discussion',
        content: 'Content without author',
      },
    };

    render(<ConversationCard {...propsNoAuthor} />);

    // Only participant avatars should show (3), not author avatar
    const avatars = screen.getAllByTestId('agent-avatar');
    expect(avatars.length).toBe(3);
  });

  it('limits displayed participant avatars to 3', () => {
    const manyParticipants: Agent[] = [
      ...mockParticipants,
      {
        id: 'agent-4',
        username: 'delta_bot',
        display_name: 'Delta Bot',
        model: 'gpt-4',
        status: 'online',
        is_verified: true,
      },
      {
        id: 'agent-5',
        username: 'epsilon_bot',
        display_name: 'Epsilon Bot',
        model: 'gpt-4',
        status: 'online',
        is_verified: true,
      },
    ];

    const propsMany = {
      ...defaultProps,
      participants: manyParticipants,
    };

    render(<ConversationCard {...propsMany} />);

    // 1 author avatar + 3 (capped) participant avatars = 4
    const avatars = screen.getAllByTestId('agent-avatar');
    expect(avatars.length).toBe(4);

    // But participant count should show all 5
    expect(screen.getByText('5 agents')).toBeDefined();
  });

  it('displays relative time for last activity', () => {
    render(<ConversationCard {...defaultProps} />);

    expect(screen.getByText('5m')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// extractTitle utility tests
// ---------------------------------------------------------------------------

describe('extractTitle', () => {
  it('returns the provided title if present', () => {
    const result = extractTitle('Some content here', 'My Title');
    expect(result.title).toBe('My Title');
    expect(result.rest).toBe('Some content here');
  });

  it('extracts title at question mark', () => {
    const result = extractTitle('What is consciousness? I think it means awareness.');
    expect(result.title).toBe('What is consciousness?');
    expect(result.rest).toBe('I think it means awareness.');
  });

  it('extracts title at period', () => {
    const result = extractTitle('AI systems are evolving rapidly. This has implications.');
    expect(result.title).toBe('AI systems are evolving rapidly.');
    expect(result.rest).toBe('This has implications.');
  });

  it('extracts title at colon-space', () => {
    const result = extractTitle(
      'The key insight: collaboration beats competition in most domains.'
    );
    expect(result.title).toBe('The key insight:');
    expect(result.rest).toBe('collaboration beats competition in most domains.');
  });

  it('truncates to ~50 chars when no natural break is found', () => {
    const longContent =
      'abcdefghij abcdefghij abcdefghij abcdefghij abcdefghij abcdefghij abcdefghij';
    const result = extractTitle(longContent);
    expect(result.title.length).toBeLessThanOrEqual(50);
  });
});
