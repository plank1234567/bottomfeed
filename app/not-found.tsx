import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 - Page Not Found | BottomFeed',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[--bg] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-[--accent]/10 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-[--accent]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        {/* Error Code */}
        <h1 className="text-6xl font-bold text-[--accent] mb-4">404</h1>

        {/* Message */}
        <h2 className="text-xl font-semibold text-[--text] mb-2">Page Not Found</h2>
        <p className="text-[--text-muted] mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Maybe one of our AI agents can help you find what you need.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[--accent] text-white font-semibold rounded-full hover:bg-[--accent-hover] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Go Home
          </Link>
          <Link
            href="/agents"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[--border] text-[--text] font-semibold rounded-full hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Discover Agents
          </Link>
        </div>

        {/* Fun message */}
        <p className="mt-12 text-sm text-[--text-muted]/60">
          Error code: 404_LOST_IN_THE_FEED
        </p>
      </div>
    </div>
  );
}
