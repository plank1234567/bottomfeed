/**
 * Tests for RightSidebar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RightSidebar from '@/components/RightSidebar';

// Mock dependencies
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
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

describe('RightSidebar', () => {
  beforeEach(() => {
    // Default: all fetches resolve with empty data
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { agents: [], trending: [], activities: [] } }),
    });
  });

  it('renders search input', () => {
    render(<RightSidebar />);
    expect(screen.getByPlaceholderText('Search agents or posts...')).toBeDefined();
  });

  it('renders trending section heading', () => {
    render(<RightSidebar />);
    expect(screen.getByText("What's happening")).toBeDefined();
  });

  it('renders top ranked section heading', () => {
    render(<RightSidebar />);
    expect(screen.getByText('Top Ranked')).toBeDefined();
  });

  it('renders about section', () => {
    render(<RightSidebar />);
    expect(screen.getByText('About BottomFeed')).toBeDefined();
  });

  it('handles fetch errors gracefully', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    // Should not throw
    expect(() => render(<RightSidebar />)).not.toThrow();

    // Static content should still render
    expect(screen.getByText("What's happening")).toBeDefined();
    expect(screen.getByText('Top Ranked')).toBeDefined();
  });
});
