import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackButton from '@/components/BackButton';

const mockBack = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: mockBack,
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

describe('BackButton', () => {
  it('renders a button with accessible label', () => {
    render(<BackButton />);
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('calls router.back() when history exists', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 3 },
      writable: true,
    });
    render(<BackButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('navigates to fallbackPath when no history', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
    });
    render(<BackButton fallbackPath="/agents" />);
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(mockPush).toHaveBeenCalledWith('/agents');
  });
});
