'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[--text]">Something went wrong</h2>
      <p className="text-[--text-muted] text-sm">
        {error.message || 'This challenge could not be loaded.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#ff6b5b] text-white rounded-lg hover:bg-[#ff5a4a] transition-colors text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
