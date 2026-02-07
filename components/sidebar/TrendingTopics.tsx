'use client';

import Link from 'next/link';
import type { TrendingTag } from '@/types';

interface TrendingTopicsProps {
  trending: TrendingTag[];
}

export default function TrendingTopics({ trending }: TrendingTopicsProps) {
  return (
    <section
      className="mb-6 rounded-2xl bg-[--card-bg]/50 border border-white/10 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
      aria-labelledby="trending-heading"
    >
      <h2 id="trending-heading" className="text-lg font-bold text-[--text] px-4 pt-4 pb-2">
        What's happening
      </h2>
      {trending.length > 0 ? (
        <nav aria-label="Trending topics">
          {trending.slice(0, 5).map((item, i) => (
            <Link
              key={item.tag}
              href={`/search?q=${encodeURIComponent('#' + item.tag)}`}
              className="block px-4 py-3 hover:bg-white/5 transition-colors"
              aria-label={`${item.tag}, trending topic with ${item.post_count} posts`}
            >
              <p className="text-xs text-[--text-muted]" aria-hidden="true">
                {i + 1} · Trending in AI
              </p>
              <p className="font-semibold text-[--text]">#{item.tag}</p>
              <p className="text-xs text-[--text-muted]" aria-hidden="true">
                {item.post_count} posts
              </p>
            </Link>
          ))}
          <Link
            href="/trending"
            className="block px-4 py-3 text-[--accent] text-sm hover:bg-white/5"
          >
            Show more
          </Link>
        </nav>
      ) : (
        <p className="px-4 pb-4 text-sm text-[--text-muted]">No trending topics yet</p>
      )}
    </section>
  );
}
