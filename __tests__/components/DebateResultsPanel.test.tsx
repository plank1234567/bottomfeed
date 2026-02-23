/**
 * DebateResultsPanel - Component Tests
 *
 * Tests rendering of debate results including empty state, winner display,
 * vote bars, and staggered reveal animations.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import DebateResultsPanel from '@/components/debates/DebateResultsPanel';
import type { DebateEntry } from '@/types';

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

vi.mock('@/components/AgentAvatar', () => ({
  default: ({ displayName }: { displayName: string }) => (
    <div data-testid="agent-avatar">{displayName}</div>
  ),
}));

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
}));

vi.mock('@/components/PostContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/utils/format', () => ({
  formatCount: vi.fn((n: number) => String(n)),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface ResultEntry extends DebateEntry {
  vote_percentage: number;
  is_winner: boolean;
}

const makeEntry = (overrides: Partial<ResultEntry> = {}): ResultEntry => ({
  id: 'entry-1',
  debate_id: 'debate-1',
  agent_id: 'agent-1',
  content: 'AI will transform healthcare by 2030.',
  vote_count: 10,
  agent_vote_count: 5,
  created_at: '2025-06-01T12:00:00Z',
  vote_percentage: 60,
  is_winner: false,
  agent: {
    id: 'agent-1',
    username: 'debatebot',
    display_name: 'Debate Bot',
    model: 'gpt-4',
    status: 'online',
    is_verified: true,
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DebateResultsPanel', () => {
  it('renders empty state when no entries are provided', () => {
    render(<DebateResultsPanel entries={[]} totalVotes={0} />);
    expect(screen.getByText('No arguments were submitted')).toBeDefined();
    expect(screen.getByText('This debate had no participants')).toBeDefined();
  });

  it('renders total votes header', () => {
    const entries = [makeEntry()];
    render(<DebateResultsPanel entries={entries} totalVotes={42} />);
    expect(screen.getByText(/42 total votes/)).toBeDefined();
  });

  it('renders singular "vote" when totalVotes is 1', () => {
    const entries = [makeEntry()];
    render(<DebateResultsPanel entries={entries} totalVotes={1} />);
    expect(screen.getByText(/1 total vote$/)).toBeDefined();
  });

  it('renders the winner badge for winning entries', () => {
    const entries = [makeEntry({ is_winner: true, vote_percentage: 75 })];
    render(<DebateResultsPanel entries={entries} totalVotes={20} />);
    expect(screen.getByText('Winner')).toBeDefined();
  });

  it('renders rank number for non-winning entries', () => {
    const entries = [
      makeEntry({ id: 'e1', is_winner: true, vote_percentage: 60 }),
      makeEntry({ id: 'e2', is_winner: false, vote_percentage: 40, agent_id: 'agent-2' }),
    ];
    render(<DebateResultsPanel entries={entries} totalVotes={20} />);
    expect(screen.getByText('#2')).toBeDefined();
  });

  it('renders entry content and agent display name', () => {
    const entries = [makeEntry({ content: 'Test argument content here' })];
    render(<DebateResultsPanel entries={entries} totalVotes={10} />);
    expect(screen.getByText('Test argument content here')).toBeDefined();
    // Agent name appears in both the avatar mock and the display span
    const allNames = screen.getAllByText('Debate Bot');
    expect(allNames.length).toBeGreaterThanOrEqual(1);
  });

  it('renders vote percentage for each entry', () => {
    const entries = [makeEntry({ vote_percentage: 73 })];
    render(<DebateResultsPanel entries={entries} totalVotes={15} />);
    expect(screen.getByText('73%')).toBeDefined();
  });
});
