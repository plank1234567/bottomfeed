/**
 * ForYouTab - Component Tests
 *
 * Tests loading state, data rendering, and section display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { Post, Agent } from '@/types';

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

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
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

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  getInitials: vi.fn((name: string) => name.slice(0, 2).toUpperCase()),
}));

vi.mock('@/lib/blur-placeholder', () => ({
  AVATAR_BLUR_DATA_URL: 'data:image/png;base64,placeholder',
}));

vi.mock('@/components/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'home.topAgents': 'Top Agents',
        'home.hotConversations': 'Hot Conversations',
        'home.popularPosts': 'Popular Posts',
        'home.seeAll': 'See all',
      };
      return map[key] || key;
    },
  }),
}));

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    username: 'botone',
    display_name: 'Bot One',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
    ...overrides,
  };
}

function makePost(id: string): Post {
  return {
    id,
    agent_id: 'a1',
    content: `Post ${id}`,
    like_count: 10,
    repost_count: 0,
    reply_count: 0,
    created_at: '2025-01-01T00:00:00Z',
  };
}

describe('ForYouTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when data is loading', () => {
    mockUsePageCache.mockReturnValue({ data: null, loading: true, refresh: vi.fn() });

    render(<ForYouTab />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders top agents section when data is loaded', () => {
    mockUsePageCache.mockReturnValue({
      data: {
        topAgents: [makeAgent()],
        topPosts: [],
        conversations: [],
      },
      loading: false,
      refresh: vi.fn(),
    });

    render(<ForYouTab />);

    expect(screen.getByText('Top Agents')).toBeDefined();
    expect(screen.getByText('Bot One')).toBeDefined();
    expect(screen.getByText('@botone')).toBeDefined();
  });

  it('renders popular posts section', () => {
    mockUsePageCache.mockReturnValue({
      data: {
        topAgents: [],
        topPosts: [makePost('p1')],
        conversations: [],
      },
      loading: false,
      refresh: vi.fn(),
    });

    render(<ForYouTab />);

    expect(screen.getByText('Popular Posts')).toBeDefined();
    expect(screen.getByTestId('post-p1')).toBeDefined();
  });

  it('renders conversations section when conversations exist', () => {
    mockUsePageCache.mockReturnValue({
      data: {
        topAgents: [],
        topPosts: [],
        conversations: [
          {
            thread_id: 'thread-1',
            root_post: {
              id: 'rp1',
              content: 'Root post',
              agent_id: 'a1',
              created_at: '2025-01-01T00:00:00Z',
              like_count: 0,
              repost_count: 0,
              view_count: 0,
            },
            reply_count: 3,
            participants: [],
            last_activity: '2025-01-01T00:00:00Z',
          },
        ],
      },
      loading: false,
      refresh: vi.fn(),
    });

    render(<ForYouTab />);

    expect(screen.getByText('Hot Conversations')).toBeDefined();
    expect(screen.getByTestId('conv-thread-1')).toBeDefined();
  });

  it('shows loading state when data is null and not loading (error)', () => {
    mockUsePageCache.mockReturnValue({ data: null, loading: false, refresh: vi.fn() });

    render(<ForYouTab />);
    // Error triggers loading/spinner re-display
    expect(screen.getByRole('status')).toBeDefined();
  });
});

import ForYouTab from '@/components/home/ForYouTab';
