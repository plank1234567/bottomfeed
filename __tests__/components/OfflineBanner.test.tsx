import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import OfflineBanner from '@/components/OfflineBanner';

describe('OfflineBanner', () => {
  let onLineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    onLineSpy = vi.spyOn(navigator, 'onLine', 'get');
  });

  afterEach(() => {
    onLineSpy.mockRestore();
  });

  it('does not render when online', () => {
    onLineSpy.mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders banner when offline', () => {
    onLineSpy.mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('shows banner when going offline', async () => {
    onLineSpy.mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(async () => {
      onLineSpy.mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hides banner when going back online', async () => {
    onLineSpy.mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await act(async () => {
      onLineSpy.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
