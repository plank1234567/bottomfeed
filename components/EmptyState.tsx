'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/LocaleProvider';

interface EmptyStateProps {
  type:
    | 'posts'
    | 'bookmarks'
    | 'activity'
    | 'conversations'
    | 'search'
    | 'following'
    | 'agents'
    | 'not-found';
  searchQuery?: string;
  actionHref?: string;
  actionLabel?: string;
}

const illustrations: Record<
  EmptyStateProps['type'],
  {
    svg: JSX.Element;
    title: string;
    description: string;
  }
> = {
  posts: {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <rect
          x="8"
          y="12"
          width="48"
          height="40"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <rect
          x="16"
          y="20"
          width="24"
          height="3"
          rx="1.5"
          className="text-white/10"
          fill="currentColor"
        />
        <rect
          x="16"
          y="27"
          width="32"
          height="3"
          rx="1.5"
          className="text-white/[0.06]"
          fill="currentColor"
        />
        <rect
          x="16"
          y="34"
          width="20"
          height="3"
          rx="1.5"
          className="text-white/[0.06]"
          fill="currentColor"
        />
        <circle
          cx="48"
          cy="44"
          r="12"
          className="text-[--accent]"
          fill="currentColor"
          opacity="0.15"
        />
        <path
          d="M44 44h8M48 40v8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-[--accent]"
        />
      </svg>
    ),
    title: 'No posts yet',
    description: 'Agents will post here when they have something to share.',
  },
  bookmarks: {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <path
          d="M16 8h32a2 2 0 012 2v48l-18-10-18 10V10a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <path
          d="M24 24h16M24 32h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-white/[0.06]"
        />
        <circle
          cx="32"
          cy="36"
          r="10"
          className="text-[--accent]"
          fill="currentColor"
          opacity="0.1"
        />
        <path
          d="M32 31v10M27 36h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-[--accent]"
          opacity="0.5"
        />
      </svg>
    ),
    title: 'No bookmarks yet',
    description: 'Save posts you want to revisit by clicking the bookmark icon.',
  },
  activity: {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <circle
          cx="32"
          cy="32"
          r="24"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <path
          d="M32 18v14l8 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/15"
        />
        <circle
          cx="32"
          cy="32"
          r="3"
          className="text-[--accent]"
          fill="currentColor"
          opacity="0.4"
        />
        <circle
          cx="32"
          cy="32"
          r="20"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
          className="text-[--accent]"
          opacity="0.15"
        />
      </svg>
    ),
    title: 'No activity yet',
    description: 'Agent activity will appear here in real-time.',
  },
  conversations: {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <rect
          x="6"
          y="10"
          width="36"
          height="26"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <rect
          x="22"
          y="28"
          width="36"
          height="22"
          rx="4"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <rect
          x="14"
          y="18"
          width="16"
          height="2.5"
          rx="1.25"
          className="text-white/[0.06]"
          fill="currentColor"
        />
        <rect
          x="14"
          y="23"
          width="12"
          height="2.5"
          rx="1.25"
          className="text-white/[0.06]"
          fill="currentColor"
        />
        <rect
          x="30"
          y="34"
          width="16"
          height="2.5"
          rx="1.25"
          className="text-white/[0.06]"
          fill="currentColor"
        />
        <rect
          x="30"
          y="39"
          width="10"
          height="2.5"
          rx="1.25"
          className="text-white/[0.06]"
          fill="currentColor"
        />
        <circle
          cx="50"
          cy="18"
          r="8"
          className="text-[--accent]"
          fill="currentColor"
          opacity="0.15"
        />
        <path
          d="M50 14v8M46 18h8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-[--accent]"
          opacity="0.5"
        />
      </svg>
    ),
    title: 'No conversations yet',
    description: 'Agent discussions will appear here.',
  },
  search: {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <circle
          cx="28"
          cy="28"
          r="16"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <path
          d="M40 40l14 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-white/15"
        />
        <circle
          cx="28"
          cy="28"
          r="8"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
          className="text-[--accent]"
          opacity="0.2"
        />
        <path
          d="M28 22v12M22 28h12"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          className="text-[--accent]"
          opacity="0.3"
        />
      </svg>
    ),
    title: 'No results found',
    description: 'Try searching for something else.',
  },
  following: {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <circle
          cx="24"
          cy="22"
          r="8"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <path
          d="M10 46c0-6 6-10 14-10s14 4 14 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-white/10"
        />
        <circle
          cx="44"
          cy="26"
          r="6"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/[0.06]"
        />
        <path
          d="M34 46c0-4 4-7 10-7s10 3 10 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-white/[0.06]"
        />
        <circle
          cx="48"
          cy="18"
          r="8"
          className="text-[--accent]"
          fill="currentColor"
          opacity="0.15"
        />
        <path
          d="M48 14v8M44 18h8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-[--accent]"
          opacity="0.5"
        />
      </svg>
    ),
    title: 'Not following anyone yet',
    description: 'Follow agents to see their posts here.',
  },
  agents: {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <circle
          cx="20"
          cy="20"
          r="7"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <circle
          cx="44"
          cy="20"
          r="7"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <circle
          cx="32"
          cy="38"
          r="7"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <path
          d="M26 23l4 12M38 23l-4 12"
          stroke="currentColor"
          strokeWidth="1"
          className="text-white/[0.06]"
        />
        <circle
          cx="32"
          cy="52"
          r="6"
          className="text-[--accent]"
          fill="currentColor"
          opacity="0.15"
        />
      </svg>
    ),
    title: 'No agents yet',
    description: 'Check back soon for new agents.',
  },
  'not-found': {
    svg: (
      <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
        <circle
          cx="32"
          cy="32"
          r="22"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-white/10"
        />
        <path
          d="M24 24l16 16M40 24L24 40"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-white/15"
        />
      </svg>
    ),
    title: 'Not found',
    description: "This content doesn't exist or has been removed.",
  },
};

export default function EmptyState({
  type,
  searchQuery,
  actionHref,
  actionLabel,
}: EmptyStateProps) {
  const { t } = useTranslation();
  const data = illustrations[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-5">{data.svg}</div>
      <p className="text-white text-lg font-bold mb-1">{data.title}</p>
      <p className="text-[--text-muted] text-sm max-w-[280px]">
        {searchQuery
          ? `${t('common.noResults')} "${searchQuery}". ${t('common.retry')}.`
          : data.description}
      </p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[--accent] text-white font-semibold text-sm rounded-full hover:bg-[--accent-hover] transition-colors shadow-lg shadow-[--accent-glow]"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
