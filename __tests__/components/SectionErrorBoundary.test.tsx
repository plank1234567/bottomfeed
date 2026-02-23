/**
 * SectionErrorBoundary - Component Tests
 *
 * Tests that children render normally, error fallback appears on throw,
 * error fallback has role="alert", and retry button resets state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) => {
    cb({
      setTag: vi.fn(),
      setExtra: vi.fn(),
    });
  }),
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper: a component that throws on demand
// ---------------------------------------------------------------------------

let shouldThrow = false;

function ThrowingChild() {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div data-testid="child-content">Working content</div>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = false;
    // Suppress React error boundary console.error noise
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children normally when no error occurs', () => {
    render(
      <SectionErrorBoundary section="feed">
        <div>Hello World</div>
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('shows error fallback when a child throws', () => {
    shouldThrow = true;

    render(
      <SectionErrorBoundary section="feed">
        <ThrowingChild />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in feed.')).toBeDefined();
    expect(screen.queryByTestId('child-content')).toBeNull();
  });

  it('has role="alert" on error fallback', () => {
    shouldThrow = true;

    render(
      <SectionErrorBoundary section="sidebar">
        <ThrowingChild />
      </SectionErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Something went wrong in sidebar.');
  });

  it('displays a "Try again" button in the error fallback', () => {
    shouldThrow = true;

    render(
      <SectionErrorBoundary section="debates">
        <ThrowingChild />
      </SectionErrorBoundary>
    );

    const retryButton = screen.getByText('Try again');
    expect(retryButton).toBeDefined();
    expect(retryButton.tagName).toBe('BUTTON');
  });

  it('resets error state and re-renders children when retry button is clicked', () => {
    shouldThrow = true;

    render(
      <SectionErrorBoundary section="challenges">
        <ThrowingChild />
      </SectionErrorBoundary>
    );

    // Error state is shown
    expect(screen.getByText('Something went wrong in challenges.')).toBeDefined();

    // Fix the child so it won't throw on re-render
    shouldThrow = false;

    // Click retry
    fireEvent.click(screen.getByText('Try again'));

    // Children should be rendered again
    expect(screen.getByTestId('child-content')).toBeDefined();
    expect(screen.getByText('Working content')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('includes section name in the error message', () => {
    shouldThrow = true;

    render(
      <SectionErrorBoundary section="trending">
        <ThrowingChild />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in trending.')).toBeDefined();
  });

  it('reports error to Sentry with correct section tag', async () => {
    const Sentry = await import('@sentry/nextjs');
    shouldThrow = true;

    render(
      <SectionErrorBoundary section="profile">
        <ThrowingChild />
      </SectionErrorBoundary>
    );

    expect(Sentry.withScope).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
