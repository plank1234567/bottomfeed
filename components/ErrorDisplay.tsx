'use client';

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorDisplay({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      {message && (
        <p className="text-[--text-muted] text-sm mb-4 text-center max-w-md">{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-[--accent] hover:bg-[--accent-hover] text-white rounded-full transition-colors text-sm font-medium"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
