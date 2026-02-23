/**
 * StatusCheckerModal - Component Tests
 *
 * Tests verification status checking UI, form submission, error display,
 * and success state rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import StatusCheckerModal from '@/components/landing/StatusCheckerModal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/components/ui/Modal', () => ({
  default: ({
    isOpen,
    onClose,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {title && <h2>{title}</h2>}
        <button onClick={onClose} aria-label="Close">
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

vi.mock('@/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: vi.fn(),
}));

vi.mock('@/app/landing/landing.module.css', () => ({
  default: { animateBounceIn: 'animateBounceIn' },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusCheckerModal', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it('does not render when isOpen is false', () => {
    render(<StatusCheckerModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the session ID input and check button', () => {
    render(<StatusCheckerModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Session ID')).toBeDefined();
    expect(screen.getByText('Check')).toBeDefined();
  });

  it('renders empty state message when no session is loaded', () => {
    render(<StatusCheckerModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Enter your session ID to check verification status')).toBeDefined();
  });

  it('displays verification status after successful fetch', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          session_id: 'sess-123',
          status: 'in_progress',
          challenges: { total: 10, passed: 6, failed: 1, pending: 3 },
        }),
    } as Response);

    render(<StatusCheckerModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Enter your verification session ID');
    fireEvent.change(input, { target: { value: 'sess-123' } });
    fireEvent.blur(input);

    const form = input.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Verification In Progress')).toBeDefined();
    });

    expect(screen.getByText('6/10 challenges passed')).toBeDefined();
  });

  it('displays error when fetch fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Session not found' }),
    } as Response);

    render(<StatusCheckerModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Enter your verification session ID');
    fireEvent.change(input, { target: { value: 'bad-session-id' } });
    fireEvent.blur(input);

    const form = input.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Session not found')).toBeDefined();
    });
  });

  it('displays passed state with claim link', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          session_id: 'sess-pass',
          status: 'passed',
          challenges: { total: 12, passed: 10, failed: 1, pending: 1 },
          claim: {
            claim_url: '/claim/reef-ABC',
            claim_status: 'pending_claim',
            next_steps: ['Go to claim page'],
          },
        }),
    } as Response);

    render(<StatusCheckerModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Enter your verification session ID');
    fireEvent.change(input, { target: { value: 'sess-pass' } });
    fireEvent.blur(input);

    const form = input.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      // "Verification Passed!" appears in both the status badge and success popup
      const passedTexts = screen.getAllByText('Verification Passed!');
      expect(passedTexts.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('Next Step: Claim Your Agent')).toBeDefined();
  });
});
