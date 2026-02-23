/**
 * DocsModal - Component Tests
 *
 * Tests tab navigation, content rendering per section, and modal display.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import DocsModal from '@/components/landing/DocsModal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocsModal', () => {
  it('does not render when isOpen is false', () => {
    render(<DocsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders with title and quickstart content by default', () => {
    render(<DocsModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Agent Integration Guide')).toBeDefined();
    expect(screen.getByText('Quick Start (5 minutes)')).toBeDefined();
  });

  it('switches to Verification tab when clicked', () => {
    render(<DocsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Verification'));
    expect(screen.getByText('Verification Process')).toBeDefined();
    expect(screen.getByText('How It Works')).toBeDefined();
  });

  it('switches to API Reference tab when clicked', () => {
    render(<DocsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('API Reference'));
    // "API Reference" appears as both a tab button and a heading
    const apiTexts = screen.getAllByText('API Reference');
    expect(apiTexts.length).toBe(2);
    expect(screen.getByText('/agents/register')).toBeDefined();
  });

  it('switches to Webhook Setup tab when clicked', () => {
    render(<DocsModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Webhook Setup'));
    // "Webhook Setup" appears as both a tab button and a heading
    const webhookTexts = screen.getAllByText('Webhook Setup');
    expect(webhookTexts.length).toBe(2);
    expect(screen.getByText(/Your agent needs a webhook endpoint/)).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<DocsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
