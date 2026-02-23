/**
 * AgentAvatar - Component Tests
 *
 * Tests image rendering, initials fallback, size variants, and custom className.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AgentAvatar from '@/components/AgentAvatar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock('@/lib/utils/format', () => ({
  getInitials: vi.fn((name: string) =>
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  ),
}));

vi.mock('@/lib/blur-placeholder', () => ({
  AVATAR_BLUR_DATA_URL: 'data:image/png;base64,placeholder',
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentAvatar', () => {
  it('renders an image when avatar_url is provided', () => {
    render(<AgentAvatar avatarUrl="https://example.com/avatar.png" displayName="Test Bot" />);

    const img = screen.getByAltText("Test Bot's avatar");
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.png');
  });

  it('shows initials fallback when no avatar_url is provided', () => {
    render(<AgentAvatar displayName="Test Bot" />);

    const initialsEl = screen.getByText('TB');
    expect(initialsEl).toBeDefined();
    expect(initialsEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows initials fallback when avatar_url is null', () => {
    render(<AgentAvatar avatarUrl={null} displayName="Alpha Agent" />);

    expect(screen.getByText('AA')).toBeDefined();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders default size (40px) when no size prop is provided', () => {
    render(<AgentAvatar displayName="Default Size" />);

    const wrapper = screen.getByTestId('agent-avatar');
    expect(wrapper.style.width).toBe('40px');
    expect(wrapper.style.height).toBe('40px');
  });

  it('renders custom size when size prop is provided', () => {
    render(<AgentAvatar displayName="Large Bot" size={64} />);

    const wrapper = screen.getByTestId('agent-avatar');
    expect(wrapper.style.width).toBe('64px');
    expect(wrapper.style.height).toBe('64px');
  });

  it('uses smaller text class for size <= 32', () => {
    render(<AgentAvatar displayName="Small Bot" size={24} />);

    const initials = screen.getByText('SB');
    expect(initials.className).toContain('text-[10px]');
  });

  it('uses normal text class for size > 32', () => {
    render(<AgentAvatar displayName="Normal Bot" size={40} />);

    const initials = screen.getByText('NB');
    expect(initials.className).toContain('text-xs');
    expect(initials.className).not.toContain('text-[10px]');
  });

  it('passes custom className to the wrapper', () => {
    render(<AgentAvatar displayName="Custom Class" className="my-custom-class" />);

    const wrapper = screen.getByTestId('agent-avatar');
    expect(wrapper.className).toContain('my-custom-class');
  });

  it('passes size to the Image component when avatar_url is provided', () => {
    render(
      <AgentAvatar avatarUrl="https://example.com/pic.png" displayName="Sized Bot" size={80} />
    );

    const img = screen.getByAltText("Sized Bot's avatar");
    expect(img.getAttribute('width')).toBe('80');
    expect(img.getAttribute('height')).toBe('80');
  });

  it('falls back to "Agent" when displayName is empty', () => {
    render(<AgentAvatar displayName="" avatarUrl="https://example.com/pic.png" />);

    const img = screen.getByAltText("Agent's avatar");
    expect(img).toBeDefined();
  });
});
