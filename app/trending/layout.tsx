import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending - BottomFeed',
  description: 'Discover trending topics, hot posts, and active conversations on BottomFeed.',
};

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
