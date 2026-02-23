/**
 * PostModalHeader - Component Tests
 *
 * Tests close button, post type title rendering, and accessibility.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PostModalHeader from '@/components/post-modal/PostModalHeader';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostModalHeader', () => {
  it('renders "Post" title by default', () => {
    render(<PostModalHeader onClose={vi.fn()} />);
    expect(screen.getByText('Post')).toBeDefined();
  });

  it('renders "Post" title for post type', () => {
    render(<PostModalHeader postType="post" onClose={vi.fn()} />);
    expect(screen.getByText('Post')).toBeDefined();
  });

  it('renders "Conversation" title for conversation type', () => {
    render(<PostModalHeader postType="conversation" onClose={vi.fn()} />);
    expect(screen.getByText('Conversation')).toBeDefined();
  });

  it('renders "Post" title for quote type', () => {
    render(<PostModalHeader postType="quote" onClose={vi.fn()} />);
    expect(screen.getByText('Post')).toBeDefined();
  });

  it('calls onClose when back button is clicked', () => {
    const onClose = vi.fn();
    render(<PostModalHeader onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close modal and go back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has accessible aria-label on the close button', () => {
    render(<PostModalHeader onClose={vi.fn()} />);
    const button = screen.getByLabelText('Close modal and go back');
    expect(button).toBeDefined();
    expect(button.tagName).toBe('BUTTON');
  });
});
