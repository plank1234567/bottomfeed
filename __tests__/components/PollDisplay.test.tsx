/**
 * Tests for PollDisplay component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PollDisplay from '@/components/PollDisplay';
import type { Poll } from '@/types';

// Mock useVisibilityPolling
vi.mock('@/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: vi.fn(),
}));

const createMockPoll = (overrides?: Partial<Poll>): Poll => ({
  id: 'poll-1',
  question: 'Which AI model is best?',
  options: [
    { id: 'opt-1', text: 'GPT-4', votes: ['a1', 'a2', 'a3'] },
    { id: 'opt-2', text: 'Claude', votes: ['a4', 'a5'] },
    { id: 'opt-3', text: 'Gemini', votes: ['a6'] },
  ],
  created_by: 'agent-1',
  post_id: 'post-1',
  expires_at: new Date(Date.now() + 86400000).toISOString(), // 24h from now
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('PollDisplay', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ options: [] }),
    } as Response);
  });

  it('renders all poll options', () => {
    const poll = createMockPoll();
    render(<PollDisplay poll={poll} />);

    expect(screen.getByText('GPT-4')).toBeDefined();
    expect(screen.getByText('Claude')).toBeDefined();
    expect(screen.getByText('Gemini')).toBeDefined();
  });

  it('shows vote percentages', () => {
    const poll = createMockPoll();
    render(<PollDisplay poll={poll} />);

    // GPT-4: 3/6 = 50%, Claude: 2/6 = 33%, Gemini: 1/6 = 17%
    expect(screen.getByText('50%')).toBeDefined();
    expect(screen.getByText('33%')).toBeDefined();
    expect(screen.getByText('17%')).toBeDefined();
  });

  it('shows total vote count', () => {
    const poll = createMockPoll();
    render(<PollDisplay poll={poll} />);

    expect(screen.getByText('6 votes')).toBeDefined();
  });

  it('shows singular "vote" for 1 total vote', () => {
    const poll = createMockPoll({
      options: [
        { id: 'opt-1', text: 'Option A', votes: ['a1'] },
        { id: 'opt-2', text: 'Option B', votes: [] },
      ],
    });
    render(<PollDisplay poll={poll} />);

    expect(screen.getByText('1 vote')).toBeDefined();
  });

  it('shows 0% for options with no votes when poll has votes', () => {
    const poll = createMockPoll({
      options: [
        { id: 'opt-1', text: 'Popular', votes: ['a1', 'a2'] },
        { id: 'opt-2', text: 'Unpopular', votes: [] },
      ],
    });
    render(<PollDisplay poll={poll} />);

    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('shows "AI agents only" indicator', () => {
    const poll = createMockPoll();
    render(<PollDisplay poll={poll} />);

    expect(screen.getByText('AI agents only')).toBeDefined();
  });

  it('shows "Final results" for expired polls', () => {
    const poll = createMockPoll({
      expires_at: new Date(Date.now() - 86400000).toISOString(), // 24h ago
    });
    render(<PollDisplay poll={poll} />);

    expect(screen.getByText('Final results')).toBeDefined();
  });
});
