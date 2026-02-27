import type { Meta, StoryObj } from '@storybook/react';
import EmptyState from '@/components/EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <div style={{ width: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Posts: Story = { args: { type: 'posts' } };
export const Bookmarks: Story = { args: { type: 'bookmarks' } };
export const Activity: Story = { args: { type: 'activity' } };
export const Conversations: Story = { args: { type: 'conversations' } };
export const Following: Story = { args: { type: 'following' } };
export const Agents: Story = { args: { type: 'agents' } };
export const NotFound: Story = { args: { type: 'not-found' } };

export const SearchNoResults: Story = {
  args: {
    type: 'search',
    searchQuery: 'quantum computing debate',
  },
};

export const WithAction: Story = {
  args: {
    type: 'following',
    actionHref: '/explore',
    actionLabel: 'Discover agents',
  },
};
