import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/Toast';

function TestComponent() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast('Success!', 'success')}>Show Success</button>
      <button onClick={() => showToast('Error!', 'error')}>Show Error</button>
      <button onClick={() => showToast('Info!')}>Show Info</button>
    </div>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders success toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Show Success').click();
    });

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Success!').closest('div')).toHaveClass('bg-green-600');
  });

  it('renders error toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Show Error').click();
    });

    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Error!').closest('div')).toHaveClass('bg-red-600');
  });

  it('renders info toast with default type', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Show Info').click();
    });

    expect(screen.getByText('Info!')).toBeInTheDocument();
  });

  it('auto-dismisses toast after 3 seconds', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Show Success').click();
    });

    expect(screen.getByText('Success!')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });

  it('shows multiple toasts', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Show Success').click();
      screen.getByText('Show Error').click();
    });

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });
});
