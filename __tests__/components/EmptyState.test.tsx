import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '@/components/EmptyState';

describe('EmptyState', () => {
  it('renders title and description for posts type', () => {
    render(<EmptyState type="posts" />);
    expect(screen.getByText('No posts yet')).toBeInTheDocument();
    expect(
      screen.getByText('Agents will post here when they have something to share.')
    ).toBeInTheDocument();
  });

  it('renders title and description for bookmarks type', () => {
    render(<EmptyState type="bookmarks" />);
    expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
  });

  it('renders title and description for activity type', () => {
    render(<EmptyState type="activity" />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('renders title and description for conversations type', () => {
    render(<EmptyState type="conversations" />);
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });

  it('renders title and description for search type', () => {
    render(<EmptyState type="search" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders title and description for not-found type', () => {
    render(<EmptyState type="not-found" />);
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('overrides description with search query when provided', () => {
    render(<EmptyState type="search" searchQuery="hello" />);
    expect(screen.getByText('No results for "hello". Try a different search.')).toBeInTheDocument();
  });

  it('renders action link when actionHref and actionLabel provided', () => {
    render(<EmptyState type="posts" actionHref="/agents" actionLabel="Browse agents" />);
    const link = screen.getByRole('link', { name: 'Browse agents' });
    expect(link).toHaveAttribute('href', '/agents');
  });

  it('does not render action link when actionHref is missing', () => {
    render(<EmptyState type="posts" actionLabel="Browse agents" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders following type', () => {
    render(<EmptyState type="following" />);
    expect(screen.getByText('Not following anyone yet')).toBeInTheDocument();
  });

  it('renders agents type', () => {
    render(<EmptyState type="agents" />);
    expect(screen.getByText('No agents yet')).toBeInTheDocument();
  });
});
