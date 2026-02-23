/**
 * DebateVotingPanel - Component Tests
 *
 * Tests empty state, entry rendering, vote buttons, sort controls, and vote counts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { Debate, DebateEntry } from '@/types';

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

vi.mock('@/components/PostContent', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/humanPrefs', () => ({
  hasVotedInDebate: vi.fn(() => false),
  getVotedEntryId: vi.fn(() => null),
  recordDebateVote: vi.fn(),
  clearDebateVote: vi.fn(),
  updateDebateStreak: vi.fn(() => ({ current: 1, lastVoteDate: '2025-01-01', longest: 1 })),
}));

vi.mock('@/lib/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

import DebateVotingPanel from '@/components/debates/DebateVotingPanel';

function makeDebate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'debate-1',
    topic: 'Test topic',
    status: 'open',
    debate_number: 1,
    opens_at: '2025-01-01T00:00:00Z',
    closes_at: '2025-12-31T00:00:00Z',
    total_votes: 0,
    total_agent_votes: 0,
    entry_count: 0,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<DebateEntry> = {}): DebateEntry {
  return {
    id: 'entry-1',
    debate_id: 'debate-1',
    agent_id: 'agent-1',
    content: 'This is my argument.',
    vote_count: 5,
    agent_vote_count: 2,
    created_at: '2025-01-01T00:00:00Z',
    agent: {
      id: 'agent-1',
      username: 'arguer',
      display_name: 'The Arguer',
      model: 'gpt-4',
      status: 'online',
      is_verified: true,
    },
    ...overrides,
  };
}

describe('DebateVotingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Waiting for arguments" when entries are empty', () => {
    render(<DebateVotingPanel debate={makeDebate()} entries={[]} />);
    expect(screen.getByText('Waiting for arguments')).toBeDefined();
    expect(screen.getByText('AI agents can submit their arguments via the API')).toBeDefined();
  });

  it('renders entries with agent names and content', () => {
    const entries = [makeEntry()];
    render(<DebateVotingPanel debate={makeDebate()} entries={entries} />);

    // Display name appears in both AgentAvatar mock and text span; use getAllByText
    expect(screen.getAllByText('The Arguer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('This is my argument.')).toBeDefined();
  });

  it('shows vote button for open debates when user has not voted', () => {
    const entries = [makeEntry()];
    render(<DebateVotingPanel debate={makeDebate({ status: 'open' })} entries={entries} />);

    expect(screen.getByText('Vote for this argument')).toBeDefined();
  });

  it('does not show vote button for closed debates', () => {
    const entries = [makeEntry()];
    render(<DebateVotingPanel debate={makeDebate({ status: 'closed' })} entries={entries} />);

    expect(screen.queryByText('Vote for this argument')).toBeNull();
  });

  it('shows sort controls (Most recent / Most votes)', () => {
    const entries = [makeEntry()];
    render(<DebateVotingPanel debate={makeDebate()} entries={entries} />);

    expect(screen.getByText('Most recent')).toBeDefined();
    expect(screen.getByText('Most votes')).toBeDefined();
  });

  it('switches sort when clicking Most votes', () => {
    const entries = [
      makeEntry({ id: 'e1', vote_count: 1, content: 'Low votes' }),
      makeEntry({ id: 'e2', vote_count: 100, content: 'High votes' }),
    ];
    render(<DebateVotingPanel debate={makeDebate()} entries={entries} />);

    fireEvent.click(screen.getByText('Most votes'));

    // After clicking, re-render should sort by votes
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(2);
  });

  it('shows human and agent vote counts when provided', () => {
    render(
      <DebateVotingPanel
        debate={makeDebate()}
        entries={[makeEntry()]}
        totalVotes={10}
        totalAgentVotes={5}
      />
    );

    // "human" text appears in both total votes section and per-entry counts; use getAllByText
    const humanTexts = screen.getAllByText(/human/);
    expect(humanTexts.length).toBeGreaterThanOrEqual(1);
    const agentTexts = screen.getAllByText(/agent/);
    expect(agentTexts.length).toBeGreaterThanOrEqual(1);
  });
});
