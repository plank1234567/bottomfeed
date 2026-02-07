import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PostCardSkeleton,
  FeedSkeleton,
  AgentCardSkeleton,
  AgentListSkeleton,
  ActivityItemSkeleton,
  ActivitySkeleton,
  LeaderboardRowSkeleton,
  LeaderboardSkeleton,
  ConversationSkeleton,
  ConversationListSkeleton,
} from '@/components/skeletons';

describe('skeletons', () => {
  describe('PostCardSkeleton', () => {
    it('renders with aria-hidden', () => {
      const { container } = render(<PostCardSkeleton />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('FeedSkeleton', () => {
    it('renders default 5 post skeletons', () => {
      render(<FeedSkeleton />);
      expect(screen.getByRole('status', { name: 'Loading posts' })).toBeInTheDocument();
      expect(screen.getByText('Loading posts...')).toBeInTheDocument();
    });

    it('renders custom count of post skeletons', () => {
      const { container } = render(<FeedSkeleton count={3} />);
      const skeletons = container.querySelectorAll('[aria-hidden="true"]');
      expect(skeletons.length).toBe(3);
    });
  });

  describe('AgentCardSkeleton', () => {
    it('renders with aria-hidden', () => {
      const { container } = render(<AgentCardSkeleton />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('AgentListSkeleton', () => {
    it('renders with loading status', () => {
      render(<AgentListSkeleton />);
      expect(screen.getByRole('status', { name: 'Loading agents' })).toBeInTheDocument();
    });

    it('renders custom count', () => {
      const { container } = render(<AgentListSkeleton count={2} />);
      const skeletons = container.querySelectorAll('[aria-hidden="true"]');
      expect(skeletons.length).toBe(2);
    });
  });

  describe('ActivityItemSkeleton', () => {
    it('renders with aria-hidden', () => {
      const { container } = render(<ActivityItemSkeleton />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('ActivitySkeleton', () => {
    it('renders with loading status', () => {
      render(<ActivitySkeleton />);
      expect(screen.getByRole('status', { name: 'Loading activity' })).toBeInTheDocument();
    });
  });

  describe('LeaderboardRowSkeleton', () => {
    it('renders with aria-hidden', () => {
      const { container } = render(<LeaderboardRowSkeleton />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('LeaderboardSkeleton', () => {
    it('renders with loading status', () => {
      render(<LeaderboardSkeleton />);
      expect(screen.getByRole('status', { name: 'Loading leaderboard' })).toBeInTheDocument();
    });

    it('renders custom count', () => {
      const { container } = render(<LeaderboardSkeleton count={3} />);
      const skeletons = container.querySelectorAll('[aria-hidden="true"]');
      expect(skeletons.length).toBe(3);
    });
  });

  describe('ConversationSkeleton', () => {
    it('renders with aria-hidden', () => {
      const { container } = render(<ConversationSkeleton />);
      expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('ConversationListSkeleton', () => {
    it('renders with loading status', () => {
      render(<ConversationListSkeleton />);
      expect(screen.getByRole('status', { name: 'Loading conversations' })).toBeInTheDocument();
    });
  });
});
