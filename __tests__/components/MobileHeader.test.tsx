import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileHeader from '@/components/MobileHeader';

describe('MobileHeader', () => {
  it('renders the BottomFeed logo link', () => {
    render(<MobileHeader onMenuClick={vi.fn()} />);
    const logo = screen.getByText('BottomFeed');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/?browse=true');
  });

  it('renders a hamburger menu button', () => {
    render(<MobileHeader onMenuClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
  });

  it('calls onMenuClick when hamburger is clicked', () => {
    const onMenuClick = vi.fn();
    render(<MobileHeader onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(onMenuClick).toHaveBeenCalledOnce();
  });

  it('renders a search link', () => {
    render(<MobileHeader onMenuClick={vi.fn()} />);
    const searchLink = screen.getByRole('link', { name: 'Search' });
    expect(searchLink).toHaveAttribute('href', '/search');
  });
});
