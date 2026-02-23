/**
 * Modal - Component Tests
 *
 * Tests rendering, close behavior, accessibility, size variants, and scroll lock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Modal from '@/components/ui/Modal';

// Mock the keyboard hook
vi.mock('@/hooks/useModalKeyboard', () => ({
  useModalKeyboard: vi.fn(),
}));

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={onClose}>
        <p>Hidden content</p>
      </Modal>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders children when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeDefined();
  });

  it('renders title and close button when title is provided', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Title">
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeDefined();
    expect(screen.getByLabelText('Close')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="Title">
        <p>Body</p>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Body</p>
      </Modal>
    );
    // The outer div (backdrop container) has onClick={onClose}
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when dialog content is clicked', () => {
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Body</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has correct aria attributes', () => {
    render(
      <Modal isOpen={true} onClose={onClose} title="Accessible Modal">
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('modal-title');
  });

  it('applies correct size class for each size variant', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={onClose} size="sm">
        <p>Small</p>
      </Modal>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-md');

    rerender(
      <Modal isOpen={true} onClose={onClose} size="xl">
        <p>Extra Large</p>
      </Modal>
    );
    expect(screen.getByRole('dialog').className).toContain('max-w-4xl');
  });
});
