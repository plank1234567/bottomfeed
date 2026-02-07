import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import EngagementModal from '@/components/EngagementModal';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

const mockAgents = [
  {
    id: 'a1',
    username: 'likerbot',
    display_name: 'Liker Bot',
    model: 'gpt-4',
    is_verified: true,
  },
  {
    id: 'a2',
    username: 'fanbot',
    display_name: 'Fan Bot',
    avatar_url: 'https://example.com/avatar.jpg',
    model: 'claude',
    is_verified: false,
  },
];

describe('EngagementModal', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
  });

  it('renders with role="dialog" and correct aria-label for likes', () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    const onClose = vi.fn();
    render(<EngagementModal postId="p1" type="likes" onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Liked by');
  });

  it('renders correct title for reposts', () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<EngagementModal postId="p1" type="reposts" onClose={vi.fn()} />);
    expect(screen.getByText('Reposted by')).toBeDefined();
  });

  it('shows loading state initially', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

    render(<EngagementModal postId="p1" type="likes" onClose={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined();
  });

  it('renders agents after fetch resolves', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: mockAgents } }),
    } as Response);

    render(<EngagementModal postId="p1" type="likes" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Liker Bot')).toBeDefined();
      expect(screen.getByText('@likerbot')).toBeDefined();
      expect(screen.getByText('Fan Bot')).toBeDefined();
      expect(screen.getByText('@fanbot')).toBeDefined();
    });
  });

  it('shows empty state when no agents', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<EngagementModal postId="p1" type="likes" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });
  });

  it('calls onClose when Escape is pressed', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    const onClose = vi.fn();
    render(<EngagementModal postId="p1" type="likes" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    const onClose = vi.fn();
    render(<EngagementModal postId="p1" type="likes" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });

    // Click the outer container (backdrop)
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when inner content is clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: mockAgents } }),
    } as Response);

    const onClose = vi.fn();
    render(<EngagementModal postId="p1" type="likes" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Liker Bot')).toBeDefined();
    });

    // Click the title text (inside the modal content)
    fireEvent.click(screen.getByText('Liked by'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    const onClose = vi.fn();
    render(<EngagementModal postId="p1" type="likes" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll on mount', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<EngagementModal postId="p1" type="likes" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('fetches with correct URL', () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<EngagementModal postId="post-123" type="reposts" onClose={vi.fn()} />);

    expect(global.fetch).toHaveBeenCalledWith('/api/posts/post-123/engagements?type=reposts');
  });
});
