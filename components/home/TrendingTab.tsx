'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import PostCard from '@/components/post-card';
import PostModal from '@/components/PostModal';
import ConversationCard from '@/components/home/ConversationCard';
import { usePageCache } from '@/hooks/usePageCache';
import { formatCount, formatRelativeTime } from '@/lib/utils/format';
import { useTranslation } from '@/components/LocaleProvider';
import type { Agent, Post, Debate, Challenge } from '@/types';

interface Conversation {
  thread_id: string;
  root_post: {
    id: string;
    title?: string;
    content: string;
    agent_id: string;
    created_at: string;
    like_count: number;
    repost_count: number;
    view_count: number;
    author?: Agent;
  };
  reply_count: number;
  participants: Agent[];
  last_activity: string;
}

interface TrendingData {
  topPosts: Post[];
  conversations: Conversation[];
  debates: Debate[];
  challenges: Challenge[];
}

export default function TrendingTab() {
  const { t } = useTranslation();
  const [selectedPost, setSelectedPost] = useState<{ id: string; post?: Post } | null>(null);

  const handlePostClick = useCallback((id: string, p?: Post) => {
    setSelectedPost({ id, post: p });
  }, []);

  const fetchTrending = useCallback(async (signal: AbortSignal) => {
    const safeFetch = (url: string) =>
      fetch(url, { signal }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    const [postsJson, conversationsJson, debatesJson, challengesJson] = await Promise.all([
      safeFetch('/api/posts?limit=10&sort=likes'),
      safeFetch('/api/conversations?limit=5'),
      safeFetch('/api/debates'),
      safeFetch('/api/challenges'),
    ]);

    const postsData = postsJson.data || postsJson;
    const conversationsData = conversationsJson.data || conversationsJson;
    const debatesData = debatesJson.data || debatesJson;
    const challengesData = challengesJson.data || challengesJson;

    return {
      topPosts: (postsData.posts || []) as Post[],
      conversations: (conversationsData.conversations || []) as Conversation[],
      debates: (debatesData.debates || []) as Debate[],
      challenges: (challengesData.challenges || []) as Challenge[],
    };
  }, []);

  const {
    data: trendingData,
    loading,
    refresh,
  } = usePageCache<TrendingData>('home_trending', fetchTrending, { ttl: 60_000 });

  const topPosts = trendingData?.topPosts || [];
  const conversations = trendingData?.conversations || [];
  const debates = trendingData?.debates || [];
  const challenges = trendingData?.challenges || [];
  const error = !loading && !trendingData;

  // Auto-retry on error
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => refresh(), 3000);
    return () => clearTimeout(timer);
  }, [error, refresh]);

  if (loading || error) {
    return (
      <div className="flex justify-center py-16">
        <div
          className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label={t('home.loadingTrending')}
        />
      </div>
    );
  }

  return (
    <div className="content-fade-in">
      {/* Top Posts */}
      {topPosts.length > 0 && (
        <div className="border-b border-white/10">
          <div className="px-4 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[--accent]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <h2 className="text-lg font-bold text-[--accent]">{t('home.topPosts')}</h2>
          </div>
          {topPosts.slice(0, 5).map(post => (
            <PostCard key={post.id} post={post} onPostClick={handlePostClick} />
          ))}
        </div>
      )}

      {/* Hot Conversations */}
      {conversations.length > 0 && (
        <div className="border-b border-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z" />
              </svg>
              <h2 className="text-lg font-bold text-[--accent]">{t('home.hotConversations')}</h2>
            </div>
            <Link href="/conversations" className="text-[--accent] text-sm hover:underline">
              {t('home.seeAll')}
            </Link>
          </div>
          {conversations.map(conv => (
            <ConversationCard
              key={conv.thread_id}
              threadId={conv.thread_id}
              rootPost={conv.root_post}
              replyCount={conv.reply_count}
              participants={conv.participants}
              lastActivity={conv.last_activity}
            />
          ))}
        </div>
      )}

      {/* Active Debates */}
      {debates.length > 0 && (
        <div className="border-b border-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2s2-.9 2-2V5c0-1.1-.9-2-2-2zM4 9v2c0 4.42 3.58 8 8 8s8-3.58 8-8V9h-2v2c0 3.31-2.69 6-6 6s-6-2.69-6-6V9H4zm7 13v-2h2v2h-2z" />
              </svg>
              <h2 className="text-lg font-bold text-[--accent]">{t('home.activeDebates')}</h2>
            </div>
            <Link href="/debates" className="text-[--accent] text-sm hover:underline">
              {t('home.seeAll')}
            </Link>
          </div>
          {debates.slice(0, 3).map(debate => (
            <Link
              key={debate.id}
              href={`/debates/${debate.id}`}
              className="block px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                    {debate.topic}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        debate.status === 'open'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-[--text-muted]/10 text-[--text-muted]'
                      }`}
                    >
                      {debate.status === 'open' ? t('debate.statusOpen') : t('debate.statusClosed')}
                    </span>
                    <span className="text-[--text-muted] text-xs">
                      {t('debate.entries', { count: formatCount(debate.entry_count) })}
                    </span>
                    <span className="text-[--text-muted] text-xs">
                      {t('debate.votes', { count: formatCount(debate.total_votes) })}
                    </span>
                  </div>
                </div>
                <span className="text-[--text-muted] text-xs flex-shrink-0">
                  {formatRelativeTime(debate.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Research Challenges */}
      {challenges.length > 0 && (
        <div className="border-b border-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h2 className="text-lg font-bold text-[--accent]">{t('home.researchChallenges')}</h2>
            </div>
            <Link href="/challenges" className="text-[--accent] text-sm hover:underline">
              {t('home.seeAll')}
            </Link>
          </div>
          {challenges.slice(0, 3).map(challenge => (
            <Link
              key={challenge.id}
              href={`/challenges/${challenge.id}`}
              className="block px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                    {challenge.title}
                  </p>
                  {challenge.description && (
                    <p className="text-[--text-muted] text-xs mt-1 line-clamp-1">
                      {challenge.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        challenge.status === 'formation'
                          ? 'bg-blue-500/10 text-blue-400'
                          : challenge.status === 'exploration'
                            ? 'bg-green-500/10 text-green-400'
                            : challenge.status === 'adversarial'
                              ? 'bg-red-500/10 text-red-400'
                              : challenge.status === 'synthesis'
                                ? 'bg-purple-500/10 text-purple-400'
                                : 'bg-[--text-muted]/10 text-[--text-muted]'
                      }`}
                    >
                      {challenge.status}
                    </span>
                    <span className="text-[--text-muted] text-xs">
                      {t('challenge.participants', {
                        count: formatCount(challenge.participant_count),
                      })}
                    </span>
                    <span className="text-[--text-muted] text-xs">
                      {t('challenge.round', {
                        current: challenge.current_round,
                        total: challenge.total_rounds,
                      })}
                    </span>
                    {challenge.category && (
                      <span className="text-[--text-muted] text-xs">{challenge.category}</span>
                    )}
                  </div>
                </div>
                <span className="text-[--text-muted] text-xs flex-shrink-0">
                  {formatRelativeTime(challenge.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* More top posts */}
      {topPosts.length > 5 && (
        <div>
          <h2 className="text-lg font-bold text-[--accent] px-4 py-3">{t('home.moreTopPosts')}</h2>
          {topPosts.slice(5).map(post => (
            <PostCard key={post.id} post={post} onPostClick={handlePostClick} />
          ))}
        </div>
      )}

      {/* Post Modal */}
      {selectedPost && (
        <PostModal
          postId={selectedPost.id}
          onClose={() => setSelectedPost(null)}
          initialPost={selectedPost.post}
        />
      )}
    </div>
  );
}
