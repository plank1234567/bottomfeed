import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CodeBlock from '@/components/CodeBlock';

// Mock prism-react-renderer
vi.mock('prism-react-renderer', () => ({
  Highlight: ({
    code,
    language,
    children,
  }: {
    code: string;
    language: string;
    children: (props: {
      className: string;
      style: Record<string, string>;
      tokens: { content: string; types: string[] }[][];
      getLineProps: (opts: { line: unknown }) => Record<string, unknown>;
      getTokenProps: (opts: { token: { content: string } }) => Record<string, unknown>;
    }) => React.ReactNode;
  }) =>
    children({
      className: `prism-${language}`,
      style: { backgroundColor: '#000' },
      tokens: code.split('\n').map(line => [{ content: line, types: ['plain'] }]),
      getLineProps: () => ({}),
      getTokenProps: ({ token }: { token: { content: string } }) => ({
        children: token.content,
      }),
    }),
  themes: { nightOwl: {} },
}));

describe('CodeBlock', () => {
  it('renders code content', () => {
    render(<CodeBlock code="const x = 1;" language="javascript" />);
    expect(screen.getByText('const x = 1;')).toBeDefined();
  });

  it('shows language badge when language is provided', () => {
    render(<CodeBlock code="print('hi')" language="python" />);
    expect(screen.getByText('python')).toBeDefined();
  });

  it('does not show language badge for text', () => {
    render(<CodeBlock code="plain text" language="text" />);
    expect(screen.queryByText('text')).toBeNull();
  });

  it('defaults language to text when not provided', () => {
    render(<CodeBlock code="no language" />);
    // Should not show a language badge
    expect(screen.queryByText('text')).toBeNull();
  });

  it('renders copy button', () => {
    render(<CodeBlock code="copy me" language="javascript" />);
    expect(screen.getByText('Copy')).toBeDefined();
  });

  it('copies code to clipboard on copy click', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CodeBlock code="  copy me  " language="javascript" />);
    fireEvent.click(screen.getByText('Copy'));

    expect(writeText).toHaveBeenCalledWith('copy me');
  });

  it('renders multiple lines of code', () => {
    render(<CodeBlock code={'line1\nline2\nline3'} language="javascript" />);
    expect(screen.getByText('line1')).toBeDefined();
    expect(screen.getByText('line2')).toBeDefined();
    expect(screen.getByText('line3')).toBeDefined();
  });

  it('renders pre element for code display', () => {
    const { container } = render(<CodeBlock code="  trimmed  " language="javascript" />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
  });
});
