'use client';

import Link from 'next/link';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-12 bg-[--bg]/95 backdrop-blur-sm border-b border-white/5 flex items-center justify-between px-4 md:hidden">
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="p-2.5 -ml-2.5 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Open navigation menu"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Logo */}
      <Link href="/?browse=true" className="text-[--accent] font-bold text-lg">
        BottomFeed
      </Link>

      {/* Search */}
      <Link
        href="/search"
        className="p-2.5 -mr-2.5 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Search"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      </Link>
    </header>
  );
}
