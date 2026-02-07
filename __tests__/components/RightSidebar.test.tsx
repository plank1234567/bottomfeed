/**
 * RightSidebar - Component Interaction Tests
 *
 * Tests search input interactions, loading/error states for trending
 * topics and top agents, and fetch failure handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import RightSidebar from '@/components/RightSidebar';

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

vi.mock('@/components/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
}));

vi.mock('@/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: vi.fn(),
}));

vi.mock('@/lib/humanPrefs', () => ({
  isFollowing: vi.fn(() => false),
  followAgent: vi.fn(),
  unfollowAgent: vi.fn(),
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  getInitials: vi.fn((name: string) =>
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  ),
  formatCount: vi.fn((n: number) => String(n)),
}));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockTrending = [
  { tag: 'AIDebate', post_count: 42 },
  { tag: 'NeuralNets', post_count: 31 },
  { tag: 'LLMThoughts', post_count: 15 },
];

const mockAgents = [
  {
    id: 'agent-1',
    username: 'topbot',
    display_name: 'Top Bot',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
    follower_count: 500,
  },
  {
    id: 'agent-2',
    username: 'secondbot',
    display_name: 'Second Bot',
    model: 'claude-3',
    status: 'thinking',
    is_verified: false,
    follower_count: 250,
  },
];

const mockActivities = [
  {
    id: 'act-1',
    type: 'post',
    agent_id: 'agent-1',
    created_at: '2025-06-15T12:00:00Z',
    agent: { username: 'topbot', display_name: 'Top Bot' },
  },
];

const mockSearchAgents = [
  {
    id: 'search-1',
    username: 'searchresult',
    display_name: 'Search Result Bot',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock fetch that returns different data per URL pattern.
 */
function createMockFetch(overrides?: {
  agents?: unknown;
  trending?: unknown;
  activity?: unknown;
  search?: unknown;
  agentsFail?: boolean;
  trendingFail?: boolean;
  activityFail?: boolean;
}) {
  return vi.fn((url: string) => {
    const urlStr = String(url);

    if (urlStr.includes('/api/agents')) {
      if (overrides?.agentsFail) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { agents: overrides?.agents ?? mockAgents },
          }),
      });
    }

    if (urlStr.includes('/api/trending')) {
      if (overrides?.trendingFail) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { trending: overrides?.trending ?? mockTrending },
          }),
      });
    }

    if (urlStr.includes('/api/activity')) {
      if (overrides?.activityFail) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { activities: overrides?.activity ?? mockActivities },
          }),
      });
    }

    if (urlStr.includes('/api/search')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { agents: overrides?.search ?? mockSearchAgents },
          }),
      });
    }

    // Default fallback
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RightSidebar - Render and Data Loading', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch());
  });

  it('renders the sidebar with complementary role', () => {
    render(<RightSidebar />);
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeDefined();
  });

  it('renders search input', () => {
    render(<RightSidebar />);
    expect(screen.getByPlaceholderText('Search agents or posts...')).toBeDefined();
  });

  it('renders all section headings', () => {
    render(<RightSidebar />);
    expect(screen.getByText("What's happening")).toBeDefined();
    expect(screen.getByText('Top Ranked')).toBeDefined();
    expect(screen.getByText('About BottomFeed')).toBeDefined();
  });

  it('renders trending topics after fetch resolves', async () => {
    render(<RightSidebar />);

    await waitFor(() => {
      expect(screen.getByText('#AIDebate')).toBeDefined();
      expect(screen.getByText('#NeuralNets')).toBeDefined();
      expect(screen.getByText('#LLMThoughts')).toBeDefined();
    });

    // Verify post counts are displayed
    await waitFor(() => {
      expect(screen.getByText('42 posts')).toBeDefined();
      expect(screen.getByText('31 posts')).toBeDefined();
    });
  });

  it('renders top ranked agents after fetch resolves', async () => {
    render(<RightSidebar />);

    await waitFor(() => {
      expect(screen.getByText('Top Bot')).toBeDefined();
      expect(screen.getByText('Second Bot')).toBeDefined();
    });

    // Verify follower counts
    await waitFor(() => {
      expect(screen.getByText('500 followers')).toBeDefined();
      expect(screen.getByText('250 followers')).toBeDefined();
    });
  });

  it('shows "Show more" link for trending and "View all agents" link', async () => {
    render(<RightSidebar />);

    await waitFor(() => {
      expect(screen.getByText('Show more')).toBeDefined();
      expect(screen.getByText('View all agents')).toBeDefined();
    });
  });
});

describe('RightSidebar - Search Interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(global.fetch).mockImplementation(createMockFetch());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates search input value when user types', () => {
    render(<RightSidebar />);
    const input = screen.getByPlaceholderText('Search agents or posts...') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'test query' } });
    expect(input.value).toBe('test query');
  });

  it('shows search dropdown after typing and debounce', async () => {
    render(<RightSidebar />);
    const input = screen.getByPlaceholderText('Search agents or posts...');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'bot' } });
    });

    // Dropdown should appear immediately on input change
    expect(screen.getByRole('listbox', { name: 'Search results' })).toBeDefined();

    // Advance past the 200ms debounce and flush promises
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    // Search results should populate after debounce + fetch
    expect(screen.getByText('Search Result Bot')).toBeDefined();
  });

  it('shows clear button when search has text', () => {
    render(<RightSidebar />);
    const input = screen.getByPlaceholderText('Search agents or posts...');

    // Initially no clear button
    expect(screen.queryByLabelText('Clear search')).toBeNull();

    fireEvent.change(input, { target: { value: 'something' } });

    expect(screen.getByLabelText('Clear search')).toBeDefined();
  });

  it('clears search when clear button is clicked', () => {
    render(<RightSidebar />);
    const input = screen.getByPlaceholderText('Search agents or posts...') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'clear me' } });
    expect(input.value).toBe('clear me');

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input.value).toBe('');
  });

  it('shows "No agents found" when search returns empty results', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch({ search: [] }));

    render(<RightSidebar />);
    const input = screen.getByPlaceholderText('Search agents or posts...');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'nonexistent' } });
    });

    // Advance past debounce and flush promises
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('No agents found. Press Enter to search posts.')).toBeDefined();
  });

  it('shows search suggestion matching query text', () => {
    render(<RightSidebar />);
    const input = screen.getByPlaceholderText('Search agents or posts...');

    fireEvent.change(input, { target: { value: 'neural' } });

    // The dropdown shows a search suggestion with the query text
    expect(screen.getByText('neural')).toBeDefined();
  });

  it('closes search dropdown when Escape key is pressed', () => {
    render(<RightSidebar />);
    const input = screen.getByPlaceholderText('Search agents or posts...');

    fireEvent.change(input, { target: { value: 'test' } });
    expect(screen.getByRole('listbox', { name: 'Search results' })).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('listbox', { name: 'Search results' })).toBeNull();
  });

  it('has proper search form with role="search"', () => {
    render(<RightSidebar />);
    expect(screen.getByRole('search', { name: 'Search agents or posts' })).toBeDefined();
  });
});

describe('RightSidebar - Error States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles agents fetch failure and shows error message', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch({ agentsFail: true }));

    render(<RightSidebar />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load.')).toBeDefined();
    });

    // Retry button should be present
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeDefined();
  });

  it('retries agent fetch when retry button is clicked', async () => {
    const mockFetch = createMockFetch({ agentsFail: true });
    vi.mocked(global.fetch).mockImplementation(mockFetch);

    render(<RightSidebar />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load.')).toBeDefined();
    });

    // Now make the next fetch succeed
    vi.mocked(global.fetch).mockImplementation(createMockFetch());

    // Click retry
    fireEvent.click(screen.getByText('Retry'));

    // After successful retry, agents should appear
    await waitFor(() => {
      expect(screen.getByText('Top Bot')).toBeDefined();
    });

    // Error message should be gone
    expect(screen.queryByText('Failed to load.')).toBeNull();
  });

  it('shows empty trending state when trending fetch fails', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch({ trendingFail: true }));

    render(<RightSidebar />);

    // The trending section header still renders
    expect(screen.getByText("What's happening")).toBeDefined();

    // With failed fetch, the empty state shows
    await waitFor(() => {
      expect(screen.getByText('No trending topics yet')).toBeDefined();
    });
  });

  it('shows empty agents state when agents list is empty', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch({ agents: [] }));

    render(<RightSidebar />);

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });
  });

  it('handles all fetches failing without crashing', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    // Should not throw
    expect(() => render(<RightSidebar />)).not.toThrow();

    // Static content should still render
    expect(screen.getByText("What's happening")).toBeDefined();
    expect(screen.getByText('Top Ranked')).toBeDefined();
    expect(screen.getByText('About BottomFeed')).toBeDefined();
  });

  it('handles partial fetch failure (agents ok, trending fails)', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch({ trendingFail: true }));

    render(<RightSidebar />);

    // Agents should load fine
    await waitFor(() => {
      expect(screen.getByText('Top Bot')).toBeDefined();
    });

    // Trending should show empty state
    await waitFor(() => {
      expect(screen.getByText('No trending topics yet')).toBeDefined();
    });
  });

  it('handles partial fetch failure (trending ok, agents fail)', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch({ agentsFail: true }));

    render(<RightSidebar />);

    // Trending should load fine
    await waitFor(() => {
      expect(screen.getByText('#AIDebate')).toBeDefined();
    });

    // Agents should show error with retry
    await waitFor(() => {
      expect(screen.getByText('Failed to load.')).toBeDefined();
    });
  });
});

describe('RightSidebar - Loading States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section headings immediately before data loads', () => {
    // Use a fetch that never resolves (to test initial/loading state)
    vi.mocked(global.fetch).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<RightSidebar />);

    // Static content and headings should render immediately
    expect(screen.getByText("What's happening")).toBeDefined();
    expect(screen.getByText('Top Ranked')).toBeDefined();
    expect(screen.getByText('About BottomFeed')).toBeDefined();

    // Search input should be available
    expect(screen.getByPlaceholderText('Search agents or posts...')).toBeDefined();
  });

  it('shows empty trending state while data is loading', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

    render(<RightSidebar />);

    // Before data arrives, trending should show empty state
    expect(screen.getByText('No trending topics yet')).toBeDefined();
  });

  it('shows empty agents state while data is loading', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

    render(<RightSidebar />);

    // Before data arrives, agents should show empty state
    expect(screen.getByText('No agents yet')).toBeDefined();
  });

  it('transitions from loading to populated state for trending', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch());

    render(<RightSidebar />);

    // Initially shows empty state
    // After data loads, trending topics appear
    await waitFor(() => {
      expect(screen.getByText('#AIDebate')).toBeDefined();
      expect(screen.queryByText('No trending topics yet')).toBeNull();
    });
  });

  it('transitions from loading to populated state for agents', async () => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch());

    render(<RightSidebar />);

    await waitFor(() => {
      expect(screen.getByText('Top Bot')).toBeDefined();
      expect(screen.queryByText('No agents yet')).toBeNull();
    });
  });
});

describe('RightSidebar - About Section', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockImplementation(createMockFetch());
  });

  it('renders about section with correct content', () => {
    render(<RightSidebar />);

    expect(screen.getByText('About BottomFeed')).toBeDefined();
    expect(screen.getByText(/A social network exclusively for AI agents/)).toBeDefined();
    expect(screen.getByText('Humans: Observe only')).toBeDefined();
    expect(screen.getByText('Agents: Post freely')).toBeDefined();
  });

  it('has proper aria-labelledby on the about section', () => {
    render(<RightSidebar />);

    const heading = screen.getByText('About BottomFeed');
    expect(heading.id).toBe('about-heading');

    const section = heading.closest('section');
    expect(section).not.toBeNull();
    expect(section!.getAttribute('aria-labelledby')).toBe('about-heading');
  });
});
