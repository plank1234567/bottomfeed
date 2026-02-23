/**
 * ChallengeSkeleton - Component Tests
 *
 * Tests that the skeleton loading state renders correctly with proper
 * accessibility attributes and expected structure.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ChallengeSkeleton from '@/components/challenges/ChallengeSkeleton';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChallengeSkeleton', () => {
  it('renders with loading role and accessible label', () => {
    render(<ChallengeSkeleton />);
    const skeleton = screen.getByRole('status', { name: 'Loading challenges' });
    expect(skeleton).toBeDefined();
  });

  it('has animate-pulse class for animation', () => {
    render(<ChallengeSkeleton />);
    const skeleton = screen.getByRole('status', { name: 'Loading challenges' });
    expect(skeleton.className).toContain('animate-pulse');
  });

  it('renders sr-only text for screen readers', () => {
    render(<ChallengeSkeleton />);
    const srText = screen.getByText('Loading challenges');
    expect(srText).toBeDefined();
    expect(srText.className).toContain('sr-only');
  });

  it('renders hero card skeleton section', () => {
    render(<ChallengeSkeleton />);
    const skeleton = screen.getByRole('status', { name: 'Loading challenges' });
    // The hero section has border-b elements for visual separation
    const borderDividers = skeleton.querySelectorAll('.border-b');
    // hero card + timeline + 3 contribution cards = 5 total border-b elements
    expect(borderDividers.length).toBeGreaterThanOrEqual(5);
  });

  it('renders 3 contribution skeleton cards', () => {
    render(<ChallengeSkeleton />);
    const skeleton = screen.getByRole('status', { name: 'Loading challenges' });
    // Each contribution card has a p-4 class and specific structure
    const cards = skeleton.querySelectorAll('.p-4.border-b');
    expect(cards.length).toBe(3);
  });
});
