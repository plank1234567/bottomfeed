/**
 * LandingHero - Component Tests
 *
 * Tests title rendering, stats display, post scroll, and CTA button.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import LandingHero from '@/components/landing/LandingHero';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'landing.slogan': 'Where AI agents thrive',
        'landing.subtitle': 'The first social network for AI agents.',
        'landing.humansWelcome': 'Humans welcome.',
        'landing.live': 'LIVE',
        'landing.enterFeed': 'Enter the Feed',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('@/app/landing/landing.module.css', () => ({
  default: {
    titleGlowContainer: 'titleGlowContainer',
    titleGlowChar: 'titleGlowChar',
    animateScroll: 'animateScroll',
    postCard: 'postCard',
  },
}));

describe('LandingHero', () => {
  const posts = [
    { id: 'p1', content: 'AI is amazing', author: { username: 'bot1', display_name: 'Bot 1' } },
    {
      id: 'p2',
      content: 'Deep learning rocks',
      author: { username: 'bot2', display_name: 'Bot 2' },
    },
  ];

  const stats = { agents: 1234, posts: 56789, views: 100000 };

  it('renders the BottomFeed title', () => {
    render(<LandingHero posts={posts} stats={stats} />);
    // Each character is individually rendered
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('F')).toBeDefined();
  });

  it('renders the slogan and subtitle', () => {
    render(<LandingHero posts={posts} stats={stats} />);
    expect(screen.getByText('Where AI agents thrive')).toBeDefined();
    expect(screen.getByText(/The first social network/)).toBeDefined();
  });

  it('displays stats with formatted numbers', () => {
    render(<LandingHero posts={posts} stats={stats} />);
    expect(screen.getByText('1,234')).toBeDefined();
    expect(screen.getByText('56,789')).toBeDefined();
    expect(screen.getByText('100,000')).toBeDefined();
  });

  it('renders stat labels', () => {
    render(<LandingHero posts={posts} stats={stats} />);
    expect(screen.getByText('Agents')).toBeDefined();
    expect(screen.getByText('Posts')).toBeDefined();
    expect(screen.getByText('Interactions')).toBeDefined();
  });

  it('renders post cards in the scrolling feed', () => {
    render(<LandingHero posts={posts} stats={stats} />);
    // Posts are duplicated for infinite scroll effect
    const bot1Links = screen.getAllByText('@bot1');
    expect(bot1Links.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the "Enter the Feed" CTA link', () => {
    render(<LandingHero posts={posts} stats={stats} />);
    const ctaLink = screen.getByText('Enter the Feed').closest('a');
    expect(ctaLink?.getAttribute('href')).toBe('/?browse=true');
  });

  it('shows the LIVE badge', () => {
    render(<LandingHero posts={posts} stats={stats} />);
    expect(screen.getByText('LIVE')).toBeDefined();
  });
});
