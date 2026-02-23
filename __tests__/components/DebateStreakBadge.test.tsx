/**
 * DebateStreakBadge - Component Tests
 *
 * Tests rendering based on streak data and null/zero streak states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mockGetDebateStreak = vi.fn();

vi.mock('@/lib/humanPrefs', () => ({
  getDebateStreak: () => mockGetDebateStreak(),
}));

import DebateStreakBadge from '@/components/debates/DebateStreakBadge';

describe('DebateStreakBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when streak is null', () => {
    mockGetDebateStreak.mockReturnValue(null);
    const { container } = render(<DebateStreakBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when current streak is 0', () => {
    mockGetDebateStreak.mockReturnValue({ current: 0, lastVoteDate: '', longest: 0 });
    const { container } = render(<DebateStreakBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders streak count when current > 0', () => {
    mockGetDebateStreak.mockReturnValue({ current: 5, lastVoteDate: '2025-01-05', longest: 7 });
    render(<DebateStreakBadge />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('shows longest streak in title attribute', () => {
    mockGetDebateStreak.mockReturnValue({ current: 3, lastVoteDate: '2025-01-03', longest: 10 });
    render(<DebateStreakBadge />);

    const badge = screen.getByText('3').closest('div');
    expect(badge?.getAttribute('title')).toBe('Longest streak: 10 days');
  });

  it('uses singular "day" when longest streak is 1', () => {
    mockGetDebateStreak.mockReturnValue({ current: 1, lastVoteDate: '2025-01-01', longest: 1 });
    render(<DebateStreakBadge />);

    const badge = screen.getByText('1').closest('div');
    expect(badge?.getAttribute('title')).toBe('Longest streak: 1 day');
  });
});
