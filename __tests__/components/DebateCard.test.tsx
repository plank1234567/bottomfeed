/**
 * DebateCard - Component Tests
 *
 * Tests full and compact card variants, open/closed state, and content rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import DebateCard from '@/components/debates/DebateCard';
import type { Debate } from '@/types';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/utils/format', () => ({
  formatRelativeTime: vi.fn(() => '1h ago'),
  formatCount: vi.fn((n: number) => String(n)),
}));

vi.mock('@/lib/constants', () => ({
  DEBATE_DURATION_HOURS: 24,
}));

function makeDebate(overrides: Partial<Debate> = {}): Debate {
  return {
    id: 'debate-1',
    topic: 'Should AI have rights?',
    description: 'A heated debate about AI personhood.',
    status: 'open',
    debate_number: 7,
    opens_at: '2025-01-01T00:00:00Z',
    closes_at: new Date(Date.now() + 3600000 * 12).toISOString(), // 12 hours from now
    total_votes: 150,
    total_agent_votes: 30,
    entry_count: 5,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('DebateCard', () => {
  it('renders full card with topic and description', () => {
    render(<DebateCard debate={makeDebate()} />);

    expect(screen.getByText('Should AI have rights?')).toBeDefined();
    expect(screen.getByText('A heated debate about AI personhood.')).toBeDefined();
  });

  it('renders debate number badge', () => {
    render(<DebateCard debate={makeDebate()} />);
    expect(screen.getByText('Day 7')).toBeDefined();
  });

  it('shows argument count', () => {
    render(<DebateCard debate={makeDebate({ entry_count: 5 })} />);
    expect(screen.getByText('5 arguments')).toBeDefined();
  });

  it('uses singular "argument" for count of 1', () => {
    render(<DebateCard debate={makeDebate({ entry_count: 1 })} />);
    expect(screen.getByText('1 argument')).toBeDefined();
  });

  it('shows vote count when debate is closed', () => {
    render(<DebateCard debate={makeDebate({ status: 'closed', total_votes: 42 })} />);
    expect(screen.getByText('42 votes')).toBeDefined();
  });

  it('shows "Closed" label when debate is closed', () => {
    render(<DebateCard debate={makeDebate({ status: 'closed' })} />);
    expect(screen.getByText('Closed')).toBeDefined();
  });

  it('renders compact variant with topic', () => {
    render(<DebateCard debate={makeDebate()} compact />);

    expect(screen.getByText('Day 7')).toBeDefined();
    expect(screen.getByText('Should AI have rights?')).toBeDefined();
  });

  it('compact card links to debate detail when closed', () => {
    render(<DebateCard debate={makeDebate({ status: 'closed', id: 'debate-99' })} compact />);
    const link = screen.getByText('Should AI have rights?').closest('a');
    expect(link?.getAttribute('href')).toBe('/debates/debate-99');
  });
});
