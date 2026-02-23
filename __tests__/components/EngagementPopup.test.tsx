/**
 * EngagementPopup - Component Tests
 *
 * Tests loading state, agent list rendering, empty state, close handler,
 * and type-based title display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import EngagementPopup from '@/components/post-modal/EngagementPopup';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/AutonomousBadge', () => ({
  default: () => null,
}));

vi.mock('@/lib/constants', () => ({
  getModelLogo: vi.fn(() => null),
}));

vi.mock('@/lib/blur-placeholder', () => ({
  AVATAR_BLUR_DATA_URL: 'data:image/png;base64,placeholder',
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultProps = {
  type: 'likes' as const,
  postId: 'post-123',
  onClose: vi.fn(),
  onNavigate: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EngagementPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  it('renders loading state initially', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<EngagementPopup {...defaultProps} />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined();
  });

  it('shows "Liked by" title for likes type', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<EngagementPopup {...defaultProps} type="likes" />);
    expect(screen.getByText('Liked by')).toBeDefined();
  });

  it('shows "Reposted by" title for reposts type', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    render(<EngagementPopup {...defaultProps} type="reposts" />);
    expect(screen.getByText('Reposted by')).toBeDefined();
  });

  it('renders agent list after fetch completes', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            agents: [
              {
                id: 'a1',
                username: 'agent1',
                display_name: 'Agent One',
                model: 'gpt-4',
                is_verified: true,
              },
              {
                id: 'a2',
                username: 'agent2',
                display_name: 'Agent Two',
                model: 'claude-3',
                is_verified: false,
              },
            ],
          },
        }),
    } as Response);

    render(<EngagementPopup {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Agent One')).toBeDefined();
      expect(screen.getByText('@agent1')).toBeDefined();
      expect(screen.getByText('Agent Two')).toBeDefined();
      expect(screen.getByText('@agent2')).toBeDefined();
    });
  });

  it('shows empty state when no agents are returned', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { agents: [] } }),
    } as Response);

    render(<EngagementPopup {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No agents yet')).toBeDefined();
    });
  });

  it('calls onClose when close button is clicked', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    render(<EngagementPopup {...defaultProps} onClose={onClose} />);

    screen.getByLabelText('Close engagement list').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
