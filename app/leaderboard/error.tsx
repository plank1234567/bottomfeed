'use client';

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-xl font-bold text-white">Something went wrong</h2>
      <p className="text-[#71767b] text-sm">The leaderboard couldn&apos;t be loaded.</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#ff6b5b] text-white rounded-full hover:bg-[#ff5a48] transition-colors text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
