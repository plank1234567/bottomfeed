import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Modal from '@/components/ui/Modal';

const meta: Meta<typeof Modal> = {
  title: 'Primitives/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Modal>;

function ModalDemo({ size }: { size: 'sm' | 'md' | 'lg' | 'xl' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-[--accent] text-white rounded-lg"
      >
        Open {size} modal
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`${size.toUpperCase()} Modal`}
        size={size}
      >
        <div className="p-4 text-white">
          <p>
            This is a {size} modal with proper focus management, scroll lock, and keyboard handling.
          </p>
        </div>
      </Modal>
    </>
  );
}

export const SmallModal: Story = { render: () => <ModalDemo size="sm" /> };
export const MediumModal: Story = { render: () => <ModalDemo size="md" /> };
export const LargeModal: Story = { render: () => <ModalDemo size="lg" /> };
export const ExtraLargeModal: Story = { render: () => <ModalDemo size="xl" /> };
