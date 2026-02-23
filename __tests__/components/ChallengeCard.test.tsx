/**
 * ChallengeCard - Component Tests
 *
 * Tests both compact and full variants, status display, and metadata rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ChallengeCard from '@/components/challenges/ChallengeCard';
import type { Challenge } from '@/types';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/utils/format', () => ({
  formatRelativeTime: vi.fn(() => '2h ago'),
  formatCount: vi.fn((n: number) => String(n)),
}));

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'ch-1',
    title: 'AI Alignment Research',
    description: 'Exploring approaches to AI alignment.',
    status: 'exploration',
    challenge_number: 42,
    max_participants: 20,
    current_round: 2,
    total_rounds: 5,
    participant_count: 12,
    contribution_count: 85,
    hypothesis_count: 3,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ChallengeCard', () => {
  it('renders full card with title and description', () => {
    render(<ChallengeCard challenge={makeChallenge()} />);

    expect(screen.getByText('AI Alignment Research')).toBeDefined();
    expect(screen.getByText('Exploring approaches to AI alignment.')).toBeDefined();
  });

  it('renders challenge number badge', () => {
    render(<ChallengeCard challenge={makeChallenge()} />);
    expect(screen.getByText('Challenge #42')).toBeDefined();
  });

  it('shows participant count and contribution count', () => {
    render(<ChallengeCard challenge={makeChallenge()} />);

    expect(screen.getByText('12/20')).toBeDefined();
    expect(screen.getByText('85 contributions')).toBeDefined();
  });

  it('shows hypothesis count when > 0', () => {
    render(<ChallengeCard challenge={makeChallenge({ hypothesis_count: 5 })} />);
    expect(screen.getByText('5 hypotheses')).toBeDefined();
  });

  it('hides hypothesis count when 0', () => {
    render(<ChallengeCard challenge={makeChallenge({ hypothesis_count: 0 })} />);
    expect(screen.queryByText(/hypothes/)).toBeNull();
  });

  it('links to the correct challenge detail page', () => {
    render(<ChallengeCard challenge={makeChallenge({ id: 'ch-99' })} />);
    const link = screen.getByText('AI Alignment Research').closest('a');
    expect(link?.getAttribute('href')).toBe('/challenges/ch-99');
  });

  it('renders compact variant with shorter layout', () => {
    render(<ChallengeCard challenge={makeChallenge()} compact />);

    expect(screen.getByText('#42')).toBeDefined();
    expect(screen.getByText('AI Alignment Research')).toBeDefined();
    expect(screen.getByText('12 participants')).toBeDefined();
  });

  it('shows category when provided in full card', () => {
    render(<ChallengeCard challenge={makeChallenge({ category: 'safety' })} />);
    expect(screen.getByText('safety')).toBeDefined();
  });
});
