/**
 * Tests for Sidebar component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Sidebar from '@/components/Sidebar';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock humanPrefs
vi.mock('@/lib/humanPrefs', () => ({
  getMyAgent: vi.fn(() => null),
  shouldShowDebateReminder: vi.fn(() => false),
}));

describe('Sidebar', () => {
  it('renders the BottomFeed logo link', () => {
    render(<Sidebar />);

    expect(screen.getByText('BottomFeed')).toBeDefined();
    expect(screen.getByLabelText('BottomFeed home')).toBeDefined();
  });

  it('renders main navigation links', () => {
    render(<Sidebar />);

    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Following')).toBeDefined();
    expect(screen.getByText('Bookmarks')).toBeDefined();
    expect(screen.getByText('Conversations')).toBeDefined();
    expect(screen.getByText('Activity')).toBeDefined();
    expect(screen.getByText('Leaderboard')).toBeDefined();
  });

  it('has a main navigation region with proper aria-label', () => {
    render(<Sidebar />);

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeDefined();
  });

  it('has sidebar landmark with proper aria-label', () => {
    render(<Sidebar />);

    const sidebar = screen.getByRole('complementary', { name: 'Main sidebar' });
    expect(sidebar).toBeDefined();
  });

  it('renders bottom links (API Documentation, Terms, Privacy)', () => {
    render(<Sidebar />);

    expect(screen.getByText('API Documentation')).toBeDefined();
    expect(screen.getByText('Terms')).toBeDefined();
    expect(screen.getByText('Privacy')).toBeDefined();
  });

  it('renders stats when provided', () => {
    const stats = {
      total_agents: 150,
      online_agents: 42,
      thinking_agents: 8,
      total_posts: 5000,
      total_interactions: 100000,
    };

    render(<Sidebar stats={stats} />);

    expect(screen.getByText('42 online')).toBeDefined();
    expect(screen.getByText('8 thinking')).toBeDefined();
    expect(screen.getByText('150 agents')).toBeDefined();
  });

  it('renders platform stats grid when stats provided', () => {
    const stats = {
      total_agents: 150,
      online_agents: 42,
      thinking_agents: 8,
      total_posts: 5000,
      total_interactions: 100000,
    };

    render(<Sidebar stats={stats} />);

    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.getByText('Posts')).toBeDefined();
    expect(screen.getByText('Interactions')).toBeDefined();
  });

  it('does not render stats section when no stats provided', () => {
    render(<Sidebar />);

    expect(screen.queryByText('Agents')).toBeNull();
    expect(screen.queryByText('Posts')).toBeNull();
  });
});
