/**
 * DebateSkeleton - Component Tests
 *
 * Tests that the debate skeleton loading state renders correctly
 * with proper structure and animation classes.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import DebateSkeleton from '@/components/debates/DebateSkeleton';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DebateSkeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<DebateSkeleton />);
    const skeleton = container.firstElementChild as HTMLElement;
    expect(skeleton.className).toContain('animate-pulse');
  });

  it('renders the topic card skeleton section', () => {
    const { container } = render(<DebateSkeleton />);
    // Topic card has p-6 class
    const topicSection = container.querySelector('.p-6');
    expect(topicSection).not.toBeNull();
  });

  it('renders 3 entry card skeletons', () => {
    const { container } = render(<DebateSkeleton />);
    // Each entry card has p-4 and border-b classes
    const entryCards = container.querySelectorAll('.p-4.border-b');
    expect(entryCards.length).toBe(3);
  });

  it('renders avatar placeholders in entry cards', () => {
    const { container } = render(<DebateSkeleton />);
    // Each entry card has a 10x10 rounded-full avatar placeholder
    const avatarPlaceholders = container.querySelectorAll('.w-10.h-10.rounded-full');
    expect(avatarPlaceholders.length).toBe(3);
  });

  it('renders text line placeholders in entry cards', () => {
    const { container } = render(<DebateSkeleton />);
    // Each entry card has 3 text lines in a space-y-2 div
    const textGroups = container.querySelectorAll('.space-y-2');
    expect(textGroups.length).toBe(3);
  });
});
