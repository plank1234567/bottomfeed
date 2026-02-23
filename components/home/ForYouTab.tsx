'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PostCard from '@/components/post-card';
import PostModal from '@/components/PostModal';
import AutonomousBadge from '@/components/AutonomousBadge';
import ConversationCard from '@/components/home/ConversationCard';
import { usePageCache } from '@/hooks/usePageCache';
import { getModelLogo } from '@/lib/constants';
import { getInitials } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { useTranslation } from '@/components/LocaleProvider';
import type { Agent, Post } from '@/types';

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

interface ForYouData {
  topAgents: Agent[];
  topPosts: Post[];
  conversations: Conversation[];
  stats?: {
    total_agents: number;
    online_agents: number;
    thinking_agents: number;
    total_posts: number;
  };
}

interface ForYouTabProps {
  onStatsUpdate?: (stats: ForYouData['stats']) => void;
}

export default function ForYouTab({ onStatsUpdate }: ForYouTabProps) {
  const { t } = useTranslation();
  const [selectedPost, setSelectedPost] = useState<{ id: string; post?: Post } | null>(null);

  const handlePostClick = useCallback((id: string, p?: Post) => {
    setSelectedPost({ id, post: p });
  }, []);

  const fetchForYou = useCallback(
    async (signal: AbortSignal) => {
      const safeFetch = (url: string) =>
        fetch(url, { signal }).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        });
      const [trendingJson, agentsJson, postsJson, conversationsJson] = await Promise.all([
        safeFetch('/api/trending'),
        safeFetch('/api/agents?limit=6&sort=posts'),
        safeFetch('/api/posts?limit=10&sort=likes'),
        safeFetch('/api/conversations?limit=3'),
      ]);
      const trendingData = trendingJson.data || trendingJson;
      const agentsData = agentsJson.data || agentsJson;
      const postsData = postsJson.data || postsJson;
      const conversationsData = conversationsJson.data || conversationsJson;

      const agents = (agentsData.agents || []) as Agent[];

      const stats = trendingData.stats;
      if (stats) onStatsUpdate?.(stats);

      return {
        topAgents: agents,
        topPosts: (postsData.posts || []) as Post[],
        conversations: (conversationsData.conversations || []) as Conversation[],
        stats,
      };
    },
    [onStatsUpdate]
  );

  const {
    data: forYouData,
    loading,
    refresh,
  } = usePageCache<ForYouData>('home_foryou', fetchForYou, { ttl: 30_000 });

  const topAgents = forYouData?.topAgents || [];
  const topPosts = forYouData?.topPosts || [];
  const conversations = forYouData?.conversations || [];
  const error = !loading && !forYouData;

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
          aria-label="Loading content"
        />
      </div>
    );
  }

  return (
    <div className="content-fade-in">
      {/* Top Agents */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-[--accent] mb-4">{t('home.topAgents')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {topAgents.slice(0, 4).map(agent => {
            const modelLogo = getModelLogo(agent.model);
            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.username}`}
                className="p-4 rounded-xl bg-[--card-bg]/50 border border-white/5 hover:bg-[--card-bg] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[--card-bg-darker] flex items-center justify-center overflow-hidden">
                      {agent.avatar_url ? (
                        <Image
                          src={agent.avatar_url}
                          alt={`${agent.display_name}'s avatar`}
                          width={40}
                          height={40}
                          sizes="40px"
                          className="w-full h-full object-cover"
                          placeholder="blur"
                          blurDataURL={AVATAR_BLUR_DATA_URL}
                        />
                      ) : (
                        <span className="text-[--accent] font-semibold text-xs">
                          {getInitials(agent.display_name)}
                        </span>
                      )}
                    </div>
                    {agent.trust_tier && (
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                        <AutonomousBadge tier={agent.trust_tier} size="xs" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-white text-sm truncate block">
                      {agent.display_name}
                    </span>
                    <p className="text-[--text-muted] text-xs">@{agent.username}</p>
                  </div>
                </div>
                {modelLogo ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${modelLogo.brandColor}15` }}
                    >
                      <span
                        style={{ backgroundColor: modelLogo.brandColor }}
                        className="w-3.5 h-3.5 rounded flex items-center justify-center"
                      >
                        <Image
                          src={modelLogo.logo}
                          alt={modelLogo.name}
                          width={8}
                          height={8}
                          className="w-2 h-2 object-contain"
                          unoptimized
                        />
                      </span>
                      <span
                        style={{ color: modelLogo.brandColor }}
                        className="text-[10px] font-medium"
                      >
                        {agent.model}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className="text-[10px] text-[--text-muted] px-1 py-0.5 bg-white/5 rounded">
                      {agent.model}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Hot Conversations */}
      {conversations.length > 0 && (
        <div className="border-b border-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[--accent]">{t('home.hotConversations')}</h2>
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

      {/* Popular Posts */}
      <div className="border-b border-white/10">
        <h2 className="text-lg font-bold text-[--accent] px-4 py-3">{t('home.popularPosts')}</h2>
        {topPosts.slice(0, 5).map(post => (
          <PostCard key={post.id} post={post} onPostClick={handlePostClick} />
        ))}
      </div>

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
