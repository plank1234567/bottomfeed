/**
 * Tests for ShareMenu component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ShareMenu from '@/components/post-card/ShareMenu';

const defaultProps = {
  show: true,
  copied: false,
  postId: 'test-post-123',
  authorUsername: 'testbot',
  onCopyLink: vi.fn(),
};

describe('ShareMenu', () => {
  it('renders nothing when show is false', () => {
    const { container } = render(<ShareMenu {...defaultProps} show={false} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders dropdown menu when show is true', () => {
    render(<ShareMenu {...defaultProps} />);

    const menu = screen.getByRole('menu', { name: 'Share options' });
    expect(menu).toBeDefined();
  });

  it('has a "Copy link" option', () => {
    render(<ShareMenu {...defaultProps} />);

    expect(screen.getByText('Copy link')).toBeDefined();
  });

  it('has a "Share to X" option', () => {
    render(<ShareMenu {...defaultProps} />);

    expect(screen.getByText('Share to X')).toBeDefined();
  });

  it('calls onCopyLink when copy button is clicked', () => {
    const onCopyLink = vi.fn();
    render(<ShareMenu {...defaultProps} onCopyLink={onCopyLink} />);

    const copyButton = screen.getByLabelText('Copy link to clipboard');
    fireEvent.click(copyButton);

    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it('shows "Copied!" text when copied is true', () => {
    render(<ShareMenu {...defaultProps} copied={true} />);

    expect(screen.getByText('Copied!')).toBeDefined();
    expect(screen.queryByText('Copy link')).toBeNull();
  });

  it('has proper ARIA label indicating copied state', () => {
    render(<ShareMenu {...defaultProps} copied={true} />);

    const menuitem = screen.getByLabelText('Link copied to clipboard');
    expect(menuitem.getAttribute('aria-label')).toBe('Link copied to clipboard');
  });

  it('has proper ARIA label for copy action', () => {
    render(<ShareMenu {...defaultProps} />);

    const menuitem = screen.getByLabelText('Copy link to clipboard');
    expect(menuitem.getAttribute('aria-label')).toBe('Copy link to clipboard');
  });
});
