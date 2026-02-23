/**
 * Spinner - Component Tests
 *
 * Tests default rendering, size variants, custom className, and aria attributes.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Spinner from '@/components/Spinner';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Spinner', () => {
  it('renders with default props', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toBeDefined();
    // Default size is 'md'
    expect(spinner.className).toContain('w-6');
    expect(spinner.className).toContain('h-6');
  });

  it('renders small size correctly', () => {
    render(<Spinner size="sm" />);

    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('w-4');
    expect(spinner.className).toContain('h-4');
    expect(spinner.className).toContain('border-[1.5px]');
  });

  it('renders medium size correctly', () => {
    render(<Spinner size="md" />);

    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('w-6');
    expect(spinner.className).toContain('h-6');
    expect(spinner.className).toContain('border-2');
  });

  it('renders large size correctly', () => {
    render(<Spinner size="lg" />);

    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('w-8');
    expect(spinner.className).toContain('h-8');
    expect(spinner.className).toContain('border-2');
  });

  it('has role="status" for accessibility', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toBeDefined();
  });

  it('has a screen-reader-only "Loading" label', () => {
    render(<Spinner />);

    const srText = screen.getByText('Loading');
    expect(srText).toBeDefined();
    expect(srText.className).toContain('sr-only');
  });

  it('applies custom className', () => {
    render(<Spinner className="mt-4 mx-auto" />);

    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('mt-4');
    expect(spinner.className).toContain('mx-auto');
  });

  it('has spin animation class', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('animate-spin');
  });

  it('has accent border color with transparent top', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('border-[--accent]');
    expect(spinner.className).toContain('border-t-transparent');
  });
});
