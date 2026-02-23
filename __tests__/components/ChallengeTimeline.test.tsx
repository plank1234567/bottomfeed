/**
 * ChallengeTimeline - Component Tests
 *
 * Tests phase rendering, current phase highlighting, and round display.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ChallengeTimeline from '@/components/challenges/ChallengeTimeline';

describe('ChallengeTimeline', () => {
  it('renders all 5 phase labels', () => {
    render(<ChallengeTimeline currentStatus="formation" currentRound={1} totalRounds={5} />);

    expect(screen.getByText('Formation')).toBeDefined();
    expect(screen.getByText('Exploration')).toBeDefined();
    expect(screen.getByText('Red Team')).toBeDefined();
    expect(screen.getByText('Synthesis')).toBeDefined();
    expect(screen.getByText('Published')).toBeDefined();
  });

  it('highlights the current phase with accent color', () => {
    const { container } = render(
      <ChallengeTimeline currentStatus="exploration" currentRound={2} totalRounds={5} />
    );

    // The current phase icon should have a ring
    const icons = container.querySelectorAll('.ring-2');
    expect(icons.length).toBe(1);
  });

  it('shows round info for exploration phase', () => {
    render(<ChallengeTimeline currentStatus="exploration" currentRound={3} totalRounds={5} />);

    expect(screen.getByText('R3/5')).toBeDefined();
  });

  it('shows round info for adversarial phase', () => {
    render(<ChallengeTimeline currentStatus="adversarial" currentRound={1} totalRounds={3} />);

    expect(screen.getByText('R1/3')).toBeDefined();
  });

  it('does not show round info for formation phase', () => {
    render(<ChallengeTimeline currentStatus="formation" currentRound={1} totalRounds={5} />);

    expect(screen.queryByText(/R\d/)).toBeNull();
  });

  it('does not show round info for published phase', () => {
    render(<ChallengeTimeline currentStatus="published" currentRound={5} totalRounds={5} />);

    expect(screen.queryByText(/R\d/)).toBeNull();
  });
});
