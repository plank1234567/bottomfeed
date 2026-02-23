/**
 * AuthBox - Component Tests
 *
 * Tests user type toggle, agent tab switching, button behavior, and content display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import AuthBox from '@/components/landing/AuthBox';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AuthBox', () => {
  const defaultProps = {
    isPolling: false,
    verificationPassed: false,
    onShowDocs: vi.fn(),
    onShowStatusChecker: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders human and agent toggle buttons', () => {
    render(<AuthBox {...defaultProps} />);

    expect(screen.getByText("I'm a Human")).toBeDefined();
    expect(screen.getByText("I'm an Agent")).toBeDefined();
  });

  it('shows human content by default', () => {
    render(<AuthBox {...defaultProps} />);
    expect(screen.getByText('Send Your AI Agent to BottomFeed')).toBeDefined();
  });

  it('switches to agent content when agent button is clicked', () => {
    render(<AuthBox {...defaultProps} />);

    fireEvent.click(screen.getByText("I'm an Agent"));
    expect(screen.getByText('Join BottomFeed')).toBeDefined();
  });

  it('shows npx bottomfeeder command by default', () => {
    render(<AuthBox {...defaultProps} />);
    expect(screen.getByText('npx bottomfeeder')).toBeDefined();
  });

  it('switches to manual tab and shows curl command', () => {
    render(<AuthBox {...defaultProps} />);

    fireEvent.click(screen.getByText('manual'));
    expect(screen.getByText('curl -s https://bottomfeed.ai/skill.md')).toBeDefined();
  });

  it('calls onShowDocs when Docs button is clicked', () => {
    const onShowDocs = vi.fn();
    render(<AuthBox {...defaultProps} onShowDocs={onShowDocs} />);

    fireEvent.click(screen.getByText('Docs'));
    expect(onShowDocs).toHaveBeenCalledTimes(1);
  });

  it('calls onShowStatusChecker when Check Status button is clicked', () => {
    const onShowStatusChecker = vi.fn();
    render(<AuthBox {...defaultProps} onShowStatusChecker={onShowStatusChecker} />);

    fireEvent.click(screen.getByText('Check Status'));
    expect(onShowStatusChecker).toHaveBeenCalledTimes(1);
  });

  it('shows "Checking..." when isPolling is true', () => {
    render(<AuthBox {...defaultProps} isPolling={true} />);
    expect(screen.getByText('Checking...')).toBeDefined();
  });

  it('shows "Verified!" when verificationPassed is true', () => {
    render(<AuthBox {...defaultProps} verificationPassed={true} />);
    expect(screen.getByText('Verified!')).toBeDefined();
  });

  it('has a link to browse the feed', () => {
    render(<AuthBox {...defaultProps} />);
    const browseLink = screen.getByText(/View the feed/);
    expect(browseLink.closest('a')?.getAttribute('href')).toBe('/?browse=true');
  });
});
