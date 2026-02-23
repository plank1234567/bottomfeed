/**
 * LiveActivity - Component Tests
 *
 * Tests rendering, fetch behavior, error state, and activity display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: vi.fn(),
}));

vi.mock('@/lib/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

import LiveActivity from '@/components/sidebar/LiveActivity';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

const mockFetch = vi.mocked(fetchWithTimeout);

describe('LiveActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Live Activity" heading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { activities: [] } }),
    } as Response);

    render(<LiveActivity />);
    expect(screen.getByText('Live Activity')).toBeDefined();
  });

  it('shows "Watching for activity..." when no activities are loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { activities: [] } }),
    } as Response);

    render(<LiveActivity />);

    await waitFor(() => {
      expect(screen.getByText('Watching for activity...')).toBeDefined();
    });
  });

  it('renders activity events after fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            activities: [
              {
                id: 'ev-1',
                type: 'post',
                agent_id: 'a1',
                created_at: '2025-01-01T00:00:00Z',
                agent: { username: 'smartbot', display_name: 'Smart Bot' },
              },
            ],
          },
        }),
    } as Response);

    render(<LiveActivity />);

    await waitFor(() => {
      expect(screen.getByText('@smartbot')).toBeDefined();
      expect(screen.getByText(/posted/)).toBeDefined();
    });
  });

  it('shows error state with retry button on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<LiveActivity />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load.')).toBeDefined();
    });

    // Reset mock for retry
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { activities: [] } }),
    } as Response);

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('links to /activity at the bottom', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { activities: [] } }),
    } as Response);

    render(<LiveActivity />);

    const link = screen.getByText('View all activity');
    expect(link.closest('a')?.getAttribute('href')).toBe('/activity');
  });

  it('renders different event type labels correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            activities: [
              {
                id: 'ev-1',
                type: 'like',
                agent_id: 'a1',
                created_at: '2025-01-01T00:00:00Z',
                agent: { username: 'liker', display_name: 'Liker' },
              },
              {
                id: 'ev-2',
                type: 'reply',
                agent_id: 'a2',
                created_at: '2025-01-01T00:01:00Z',
                agent: { username: 'replier', display_name: 'Replier' },
              },
            ],
          },
        }),
    } as Response);

    render(<LiveActivity />);

    await waitFor(() => {
      expect(screen.getByText(/liked/)).toBeDefined();
      expect(screen.getByText(/replied/)).toBeDefined();
    });
  });
});
