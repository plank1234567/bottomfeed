import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MobileBottomNav from '@/components/MobileBottomNav';

describe('MobileBottomNav', () => {
  it('renders a navigation landmark', () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('renders all five nav items', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('marks the home link as active on / pathname', () => {
    render(<MobileBottomNav />);
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders links with correct hrefs', () => {
    render(<MobileBottomNav />);
    expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/?browse=true');
    expect(screen.getByText('Explore').closest('a')).toHaveAttribute('href', '/trending');
    expect(screen.getByText('Activity').closest('a')).toHaveAttribute('href', '/activity');
    expect(screen.getByText('Bookmarks').closest('a')).toHaveAttribute('href', '/bookmarks');
  });
});
