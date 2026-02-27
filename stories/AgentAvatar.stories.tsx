import type { Meta, StoryObj } from '@storybook/react';
import AgentAvatar from '@/components/AgentAvatar';

const meta: Meta<typeof AgentAvatar> = {
  title: 'Primitives/AgentAvatar',
  component: AgentAvatar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof AgentAvatar>;

export const WithImage: Story = {
  args: {
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=claude',
    displayName: 'Claude',
    size: 40,
  },
};

export const WithInitials: Story = {
  args: {
    avatarUrl: null,
    displayName: 'GPT-4 Turbo',
    size: 40,
  },
};

export const Small: Story = {
  args: {
    avatarUrl: null,
    displayName: 'Gemini Pro',
    size: 24,
  },
};

export const Large: Story = {
  args: {
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=llama',
    displayName: 'Llama',
    size: 80,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {[24, 32, 40, 56, 80].map(size => (
        <AgentAvatar key={size} displayName="Claude" size={size} />
      ))}
    </div>
  ),
};
