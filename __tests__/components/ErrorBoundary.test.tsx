/**
 * Tests for ErrorBoundary component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: vi.fn(callback => callback({ setExtras: vi.fn() })),
}));

// A component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from child');
  }
  return <div>Child content renders fine</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error from React error boundary logging
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>All good here</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('All good here')).toBeDefined();
  });

  it('shows default error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText(/An unexpected error occurred/)).toBeDefined();
  });

  it('shows the error message in non-production', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test error from child')).toBeDefined();
  });

  it('has a "Try Again" button that resets error state', () => {
    let shouldThrow = true;
    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Test error from child');
      return <div>Child content renders fine</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();

    const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
    expect(tryAgainButton).toBeDefined();

    // Stop throwing, then click reset
    shouldThrow = false;
    fireEvent.click(tryAgainButton);

    expect(screen.getByText('Child content renders fine')).toBeDefined();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error fallback</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error fallback')).toBeDefined();
    // Should NOT show the default UI
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('does not show error UI for non-throwing children', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.getByText('Child content renders fine')).toBeDefined();
  });
});
