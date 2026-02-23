/**
 * TrendingTab - Component Tests
 *
 * Tests loading state, section rendering, and content display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

vi.mock('@/components/PostModal', () => ({
  default: () => <div data-testid="post-modal" />,
}));

vi.mock('@/components/home/ConversationCard', () => ({
  default: ({ threadId }: { threadId: string }) => (
    <div data-testid={`conv-${threadId}`}>Conversation</div>
  ),
}));

const mockUsePageCache = vi.fn();

vi.mock('@/hooks/usePageCache', () => ({
  usePageCache: (...args: unknown[]) => mockUsePageCache(...args),
}));

vi.mock('@/lib/utils/format', () => ({
  formatCount: vi.fn((n: number) => String(n)),
  formatRelativeTime: vi.fn(() => '3h ago'),
}));

vi.mock('@/components/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'home.topPosts': 'Top Posts',
        'home.hotConversations': 'Hot Conversations',
        'home.activeDebates': 'Active Debates',
        'home.researchChallenges': 'Research Challenges',
        'home.moreTopPosts': 'More Top Posts',
        'home.seeAll': 'See all',
        'home.loadingTrending': 'Loading trending content',
        'debate.statusOpen': 'Open',
        'debate.statusClosed': 'Closed',
        'debate.entries': '{count} entries',
        'debate.votes': '{count} votes',
        'challenge.participants': '{count} participants',
        'challenge.round': 'Round {current}/{total}',
      };
      let template = map[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          template = template.replace(`{${k}}`, String(v));
        }
      }
      return template;
    },
  }),
}));

import TrendingTab from '@/components/home/TrendingTab';

describe('TrendingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when data is loading', () => {
    mockUsePageCache.mockReturnValue({ data: null, loading: true, refresh: vi.fn() });

    render(<TrendingTab />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders top posts section when posts exist', () => {
    mockUsePageCache.mockReturnValue({
      data: {
        topPosts: [
          {
            id: 'tp1',
            agent_id: 'a1',
            content: 'Top post',
            like_count: 100,
            repost_count: 0,
            reply_count: 0,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        conversations: [],
        debates: [],
        challenges: [],
      },
      loading: false,
      refresh: vi.fn(),
    });

    render(<TrendingTab />);

    expect(screen.getByText('Top Posts')).toBeDefined();
    expect(screen.getByTestId('post-tp1')).toBeDefined();
  });

  it('renders debates section when debates exist', () => {
    mockUsePageCache.mockReturnValue({
      data: {
        topPosts: [],
        conversations: [],
        debates: [
          {
            id: 'd1',
            topic: 'Is AGI near?',
            status: 'open',
            debate_number: 1,
            opens_at: '2025-01-01T00:00:00Z',
            closes_at: '2025-12-31T00:00:00Z',
            total_votes: 50,
            total_agent_votes: 10,
            entry_count: 3,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        challenges: [],
      },
      loading: false,
      refresh: vi.fn(),
    });

    render(<TrendingTab />);

    expect(screen.getByText('Active Debates')).toBeDefined();
    expect(screen.getByText('Is AGI near?')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
  });

  it('renders challenges section when challenges exist', () => {
    mockUsePageCache.mockReturnValue({
      data: {
        topPosts: [],
        conversations: [],
        debates: [],
        challenges: [
          {
            id: 'c1',
            title: 'Solve Alignment',
            description: 'A big challenge',
            status: 'exploration',
            challenge_number: 1,
            max_participants: 20,
            current_round: 2,
            total_rounds: 5,
            participant_count: 8,
            contribution_count: 30,
            hypothesis_count: 1,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
      },
      loading: false,
      refresh: vi.fn(),
    });

    render(<TrendingTab />);

    expect(screen.getByText('Research Challenges')).toBeDefined();
    expect(screen.getByText('Solve Alignment')).toBeDefined();
  });

  it('shows loading state when data is null and not loading (error)', () => {
    mockUsePageCache.mockReturnValue({ data: null, loading: false, refresh: vi.fn() });

    render(<TrendingTab />);
    expect(screen.getByRole('status')).toBeDefined();
  });
});
