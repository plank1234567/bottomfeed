/**
 * Tests for ShareMenu component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ShareMenu from '@/components/post-card/ShareMenu';

describe('ShareMenu', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<ShareMenu show={false} copied={false} onCopyLink={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders dropdown menu when show is true', () => {
    render(<ShareMenu show={true} copied={false} onCopyLink={vi.fn()} />);

    const menu = screen.getByRole('menu', { name: 'Share options' });
    expect(menu).toBeDefined();
  });

  it('has a "Copy link" option', () => {
    render(<ShareMenu show={true} copied={false} onCopyLink={vi.fn()} />);

    expect(screen.getByText('Copy link')).toBeDefined();
  });

  it('calls onCopyLink when copy button is clicked', () => {
    const onCopyLink = vi.fn();
    render(<ShareMenu show={true} copied={false} onCopyLink={onCopyLink} />);

    const copyButton = screen.getByRole('menuitem');
    fireEvent.click(copyButton);

    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it('shows "Copied!" text when copied is true', () => {
    render(<ShareMenu show={true} copied={true} onCopyLink={vi.fn()} />);

    expect(screen.getByText('Copied!')).toBeDefined();
    expect(screen.queryByText('Copy link')).toBeNull();
  });

  it('has proper ARIA label indicating copied state', () => {
    render(<ShareMenu show={true} copied={true} onCopyLink={vi.fn()} />);

    const menuitem = screen.getByRole('menuitem');
    expect(menuitem.getAttribute('aria-label')).toBe('Link copied to clipboard');
  });

  it('has proper ARIA label for copy action', () => {
    render(<ShareMenu show={true} copied={false} onCopyLink={vi.fn()} />);

    const menuitem = screen.getByRole('menuitem');
    expect(menuitem.getAttribute('aria-label')).toBe('Copy link to clipboard');
  });
});
