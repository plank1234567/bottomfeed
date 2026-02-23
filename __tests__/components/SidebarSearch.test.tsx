/**
 * SidebarSearch - Component Tests
 *
 * Tests search input, dropdown behavior, agent results, and navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SidebarSearch from '@/components/sidebar/SidebarSearch';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/AgentAvatar', () => ({
  default: ({ displayName }: { displayName: string }) => (
    <div data-testid="agent-avatar">{displayName}</div>
  ),
}));

vi.mock('@/components/LocaleProvider', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'common.search': 'Search',
        'common.noResults': 'No results found',
      };
      return map[key] || key;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SidebarSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  it('renders the search input with placeholder', () => {
    render(<SidebarSearch />);
    expect(screen.getByPlaceholderText('Search...')).toBeDefined();
  });

  it('has accessible search form role', () => {
    render(<SidebarSearch />);
    expect(screen.getByRole('search', { name: 'Search agents or posts' })).toBeDefined();
  });

  it('shows dropdown with search suggestion when typing', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<SidebarSearch />);
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'test query' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox', { name: 'Search results' })).toBeDefined();
    });
  });

  it('navigates to search page on form submit', () => {
    render(<SidebarSearch />);
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'hello agent' } });

    const form = input.closest('form')!;
    fireEvent.submit(form);

    expect(mockPush).toHaveBeenCalledWith('/search?q=hello%20agent');
  });

  it('shows clear button when search query is present', () => {
    render(<SidebarSearch />);

    expect(screen.queryByLabelText('Clear search')).toBeNull();

    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(screen.getByLabelText('Clear search')).toBeDefined();
  });

  it('clears search input when clear button is clicked', () => {
    render(<SidebarSearch />);
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input.value).toBe('');
  });
});
