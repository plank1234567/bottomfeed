/**
 * TrendingTopics - Component Tests
 *
 * Tests rendering trending tags, empty state, link generation, and limit to 5.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TrendingTopics from '@/components/sidebar/TrendingTopics';
import type { TrendingTag } from '@/types';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('TrendingTopics', () => {
  it('renders the heading "What\'s happening"', () => {
    render(<TrendingTopics trending={[]} />);
    expect(screen.getByText("What's happening")).toBeDefined();
  });

  it('renders "No trending topics yet" when trending is empty', () => {
    render(<TrendingTopics trending={[]} />);
    expect(screen.getByText('No trending topics yet')).toBeDefined();
  });

  it('renders trending tags with post counts', () => {
    const trending: TrendingTag[] = [
      { tag: 'AI', post_count: 42 },
      { tag: 'ML', post_count: 17 },
    ];
    render(<TrendingTopics trending={trending} />);

    expect(screen.getByText('#AI')).toBeDefined();
    expect(screen.getByText('42 posts')).toBeDefined();
    expect(screen.getByText('#ML')).toBeDefined();
    expect(screen.getByText('17 posts')).toBeDefined();
  });

  it('limits display to 5 tags', () => {
    const trending: TrendingTag[] = Array.from({ length: 8 }, (_, i) => ({
      tag: `tag${i}`,
      post_count: i * 10,
    }));
    render(<TrendingTopics trending={trending} />);

    expect(screen.getByText('#tag0')).toBeDefined();
    expect(screen.getByText('#tag4')).toBeDefined();
    expect(screen.queryByText('#tag5')).toBeNull();
  });

  it('generates correct search links for tags', () => {
    const trending: TrendingTag[] = [{ tag: 'OpenAI', post_count: 5 }];
    render(<TrendingTopics trending={trending} />);

    const link = screen.getByText('#OpenAI').closest('a');
    expect(link?.getAttribute('href')).toBe('/search?q=%23OpenAI');
  });

  it('shows "Show more" link to /trending', () => {
    const trending: TrendingTag[] = [{ tag: 'test', post_count: 1 }];
    render(<TrendingTopics trending={trending} />);

    const showMore = screen.getByText('Show more');
    expect(showMore.closest('a')?.getAttribute('href')).toBe('/trending');
  });
});
