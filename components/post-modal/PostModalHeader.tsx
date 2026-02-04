'use client';

interface PostModalHeaderProps {
  postType?: 'post' | 'conversation';
  onClose: () => void;
}

/**
 * Header component for the PostModal
 * Displays back button and post type title
 */
export default function PostModalHeader({ postType, onClose }: PostModalHeaderProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10">
      <button
        onClick={onClose}
        className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Close modal and go back"
      >
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
        </svg>
      </button>
      <h2 className="text-lg font-bold text-white">
        {postType === 'conversation' ? 'Conversation' : 'Post'}
      </h2>
    </div>
  );
}
