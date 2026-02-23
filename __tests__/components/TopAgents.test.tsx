/**
 * TopAgents - Component Tests
 *
 * Tests rendering agent list, empty state, error state, and link behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TopAgents from '@/components/sidebar/TopAgents';
import type { Agent } from '@/types';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/AgentAvatar', () => ({
  default: ({ displayName }: { displayName: string }) => (
    <div data-testid="agent-avatar">{displayName}</div>
  ),
}));

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  formatCount: vi.fn((n: number) => String(n)),
  getStatusColor: vi.fn(() => 'bg-green-500'),
}));

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    username: 'testbot',
    display_name: 'Test Bot',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
    follower_count: 100,
    ...overrides,
  };
}

describe('TopAgents', () => {
  const onRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading "Top Ranked"', () => {
    render(<TopAgents agents={[]} error={false} onRetry={onRetry} />);
    expect(screen.getByText('Top Ranked')).toBeDefined();
  });

  it('renders "No agents yet" when agents array is empty', () => {
    render(<TopAgents agents={[]} error={false} onRetry={onRetry} />);
    expect(screen.getByText('No agents yet')).toBeDefined();
  });

  it('renders agent display names and follower counts', () => {
    const agents = [
      makeAgent({ id: '1', username: 'bot1', display_name: 'Bot One', follower_count: 42 }),
      makeAgent({ id: '2', username: 'bot2', display_name: 'Bot Two', follower_count: 99 }),
    ];
    render(<TopAgents agents={agents} error={false} onRetry={onRetry} />);

    // Display name appears in both AgentAvatar mock and text; use getAllByText
    expect(screen.getAllByText('Bot One').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('42 followers')).toBeDefined();
    expect(screen.getAllByText('Bot Two').length).toBeGreaterThanOrEqual(1);
  });

  it('limits display to 5 agents', () => {
    const agents = Array.from({ length: 8 }, (_, i) =>
      makeAgent({ id: `a${i}`, username: `bot${i}`, display_name: `Bot ${i}` })
    );
    render(<TopAgents agents={agents} error={false} onRetry={onRetry} />);

    // Only 5 should appear
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(5);
  });

  it('shows error message and retry button when error is true', () => {
    render(<TopAgents agents={[]} error={true} onRetry={onRetry} />);
    expect(screen.getByText('Failed to load.')).toBeDefined();
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('links to /agents at the bottom ("View all agents")', () => {
    const agents = [makeAgent()];
    render(<TopAgents agents={agents} error={false} onRetry={onRetry} />);
    const viewAllLink = screen.getByText('View all agents');
    expect(viewAllLink.closest('a')?.getAttribute('href')).toBe('/agents');
  });
});
