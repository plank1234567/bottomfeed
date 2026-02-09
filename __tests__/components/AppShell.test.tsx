import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AppShell from '@/components/AppShell';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

vi.mock('@/components/Sidebar', () => ({
  default: () => <nav data-testid="sidebar">Sidebar</nav>,
}));

vi.mock('@/components/RightSidebar', () => ({
  default: () => <aside data-testid="right-sidebar">RightSidebar</aside>,
}));

vi.mock('@/components/MobileHeader', () => ({
  default: ({ onMenuClick }: { onMenuClick: () => void }) => (
    <header data-testid="mobile-header">
      <button onClick={onMenuClick} data-testid="menu-btn">
        Menu
      </button>
    </header>
  ),
}));

vi.mock('@/components/MobileBottomNav', () => ({
  default: () => <nav data-testid="mobile-bottom-nav">BottomNav</nav>,
}));

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children in main content area', () => {
    render(
      <AppShell>
        <div data-testid="child">Page content</div>
      </AppShell>
    );
    // Children rendered in both desktop + mobile main areas
    expect(screen.getAllByTestId('child').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('main').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile header and bottom nav', () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId('mobile-header')).toBeDefined();
    expect(screen.getByTestId('mobile-bottom-nav')).toBeDefined();
  });

  it('renders sidebar components', () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getAllByTestId('sidebar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('right-sidebar')).toBeDefined();
  });

  it('opens drawer when menu button is clicked', () => {
    render(<AppShell>Content</AppShell>);
    fireEvent.click(screen.getByTestId('menu-btn'));

    // Drawer should be visible (dialog with aria-modal)
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(drawer).toBeDefined();
    expect(drawer.getAttribute('aria-modal')).toBe('true');
  });

  it('closes drawer on Escape key', () => {
    render(<AppShell>Content</AppShell>);
    fireEvent.click(screen.getByTestId('menu-btn'));

    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });

    // aria-modal should be false when closed
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(drawer.getAttribute('aria-modal')).toBe('false');
  });

  it('closes drawer when backdrop is clicked', () => {
    render(<AppShell>Content</AppShell>);
    fireEvent.click(screen.getByTestId('menu-btn'));

    // Click backdrop (aria-hidden div)
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(drawer.getAttribute('aria-modal')).toBe('false');
  });

  it('locks body scroll when drawer is open', () => {
    render(<AppShell>Content</AppShell>);
    fireEvent.click(screen.getByTestId('menu-btn'));

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when drawer closes', () => {
    render(<AppShell>Content</AppShell>);
    fireEvent.click(screen.getByTestId('menu-btn'));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });
});
