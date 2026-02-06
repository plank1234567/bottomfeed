/**
 * Tests for PostContent component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PostContent from '@/components/PostContent';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock ProfileHoverCard as pass-through
vi.mock('@/components/ProfileHoverCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/dynamic (for CodeBlock)
vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ code, language }: { code: string; language: string }) => (
      <pre data-testid="code-block" data-language={language}>
        {code}
      </pre>
    ),
}));

describe('PostContent', () => {
  it('renders plain text content', () => {
    render(<PostContent content="Hello world, this is a test post." />);
    expect(screen.getByText(/Hello world, this is a test post\./)).toBeDefined();
  });

  it('renders @mentions as links', () => {
    render(<PostContent content="Hey @coolbot check this out" />);

    const mentionLink = screen.getByText('@coolbot');
    expect(mentionLink).toBeDefined();
    expect(mentionLink.closest('a')).toBeDefined();
    expect(mentionLink.closest('a')?.getAttribute('href')).toBe('/agent/coolbot');
  });

  it('renders #hashtags as links', () => {
    render(<PostContent content="Talking about #AI and more" />);

    // Hashtags are rendered separately at the bottom by default
    const hashtagLink = screen.getByText('#AI');
    expect(hashtagLink).toBeDefined();
    expect(hashtagLink.closest('a')).toBeDefined();
    expect(hashtagLink.closest('a')?.getAttribute('href')).toContain('/search');
  });

  it('renders hashtags inline when showHashtagsInline is true', () => {
    render(<PostContent content="Talking about #AI today" showHashtagsInline />);

    const hashtagLink = screen.getByText('#AI');
    expect(hashtagLink).toBeDefined();
    expect(hashtagLink.closest('a')?.getAttribute('href')).toContain('/search');
  });

  it('renders multiple @mentions correctly', () => {
    render(<PostContent content="Hey @alice and @bob" />);

    expect(screen.getByText('@alice')).toBeDefined();
    expect(screen.getByText('@bob')).toBeDefined();
  });

  it('renders inline code with backticks', () => {
    render(<PostContent content="Use the `console.log` function" />);

    const codeElement = screen.getByText('console.log');
    expect(codeElement).toBeDefined();
    expect(codeElement.tagName.toLowerCase()).toBe('code');
  });

  it('deduplicates hashtags in the bottom section', () => {
    render(<PostContent content="Hello #AI world #AI again" />);

    // Only one #AI should appear in the bottom hashtag section
    const hashtags = screen.getAllByText('#AI');
    // One in the bottom section (content has hashtags stripped for bottom display)
    expect(hashtags.length).toBe(1);
  });
});
