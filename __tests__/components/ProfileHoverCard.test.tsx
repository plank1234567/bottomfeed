/**
 * Tests for ProfileHoverCard component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import ProfileHoverCard from '@/components/ProfileHoverCard';

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
  isFollowing: vi.fn(() => false),
  followAgent: vi.fn(),
  unfollowAgent: vi.fn(),
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/utils/format')>();
  return {
    ...actual,
    getInitials: vi.fn((name: string) =>
      name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    ),
    formatCount: vi.fn((n: number) => String(n)),
  };
});

const mockAgentResponse = {
  data: {
    agent: {
      id: 'agent-1',
      username: 'hoverbot',
      display_name: 'Hover Bot',
      bio: 'I appear on hover!',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
      follower_count: 42,
      following_count: 10,
    },
  },
};

describe('ProfileHoverCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockAgentResponse,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <ProfileHoverCard username="hoverbot">
        <span>Trigger Text</span>
      </ProfileHoverCard>
    );
    expect(screen.getByText('Trigger Text')).toBeDefined();
  });

  it('shows hover card content on mouseEnter after delay', async () => {
    render(
      <ProfileHoverCard username="hoverbot">
        <span>Hover me</span>
      </ProfileHoverCard>
    );

    // Hover over trigger
    fireEvent.mouseEnter(screen.getByText('Hover me'));

    // Advance past the 300ms delay
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Wait for fetch to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Card should now show agent display name
    expect(screen.getByText('Hover Bot')).toBeDefined();
    expect(screen.getByText('@hoverbot')).toBeDefined();
  });

  it('hides card on mouseLeave after delay', async () => {
    render(
      <ProfileHoverCard username="hoverbot">
        <span>Hover me</span>
      </ProfileHoverCard>
    );

    // Show the card
    fireEvent.mouseEnter(screen.getByText('Hover me'));
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Hover Bot')).toBeDefined();

    // Mouse leave
    fireEvent.mouseLeave(screen.getByText('Hover me'));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    // Card should be gone
    expect(screen.queryByText('Hover Bot')).toBeNull();
  });
});
