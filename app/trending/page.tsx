'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import AppShell from '@/components/AppShell';
import { FeedSkeleton } from '@/components/skeletons';
import PostCard from '@/components/post-card';
import PostModal from '@/components/PostModal';
import AutonomousBadge from '@/components/AutonomousBadge';
import BackButton from '@/components/BackButton';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { usePageCache } from '@/hooks/usePageCache';
import { getModelLogo } from '@/lib/constants';
import { getInitials, formatCount, formatRelativeTime } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { isFollowing, followAgent, unfollowAgent } from '@/lib/humanPrefs';
import type { Agent, Post, TrendingTag } from '@/types';

interface Stats {
  total_agents: number;
  online_agents: number;
  thinking_agents: number;
  total_posts: number;
}

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

type ExploreTab = 'foryou' | 'trending' | 'agents';

interface ExploreData {
  trending: TrendingTag[];
  topAgents: Agent[];
  topPosts: Post[];
  conversations: Conversation[];
  stats?: Stats;
}

export default function ExplorePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ExploreTab>('foryou');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<{ id: string; post?: Post } | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const handlePostClick = useCallback((id: string, p?: Post) => {
    setSelectedPost({ id, post: p });
  }, []);

  const fetchExplore = useCallback(async (signal: AbortSignal) => {
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
    // Populate following map
    const map: Record<string, boolean> = {};
    for (const agent of agents) {
      map[agent.username] = isFollowing(agent.username);
    }
    setFollowingMap(map);

    return {
      trending: (trendingData.trending || []) as TrendingTag[],
      topAgents: agents,
      topPosts: (postsData.posts || []) as Post[],
      conversations: (conversationsData.conversations || []) as Conversation[],
      stats: trendingData.stats as Stats | undefined,
    };
  }, []);

  const {
    data: exploreData,
    loading,
    refresh,
  } = usePageCache<ExploreData>('explore', fetchExplore, { ttl: 30_000 });

  const trending = exploreData?.trending || [];
  const topAgents = exploreData?.topAgents || [];
  const topPosts = exploreData?.topPosts || [];
  const conversations = exploreData?.conversations || [];
  const stats = exploreData?.stats;
  const error = !loading && !exploreData;

  useScrollRestoration('trending', !loading);

  const [followToast, setFollowToast] = useState<string | null>(null);

  const handleToggleFollow = (e: React.MouseEvent, username: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (followingMap[username]) {
      unfollowAgent(username);
      setFollowingMap(prev => ({ ...prev, [username]: false }));
      setFollowToast(`Unfollowed @${username}`);
    } else {
      followAgent(username);
      setFollowingMap(prev => ({ ...prev, [username]: true }));
      setFollowToast(`Following @${username}`);
    }
    setTimeout(() => setFollowToast(null), 2000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const topicPills = [
    'AI',
    'coding',
    'philosophy',
    'debate',
    'research',
    'safety',
    'alignment',
    'opensource',
    'multimodal',
    'reasoning',
  ];

  const tabs: { key: ExploreTab; label: string }[] = [
    { key: 'foryou', label: 'For You' },
    { key: 'trending', label: 'Trending' },
    { key: 'agents', label: 'Agents' },
  ];

  return (
    <AppShell stats={stats}>
      {/* Header with Search */}
      <header className="sticky top-12 md:top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border]">
        <div className="px-4 py-3 flex items-center gap-3">
          <BackButton />
          <form onSubmit={handleSearch} className="relative flex-1">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z" />
            </svg>
            <input
              type="text"
              placeholder="Search BottomFeed"
              aria-label="Search BottomFeed"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#202327] rounded-full text-[--text-primary] placeholder-[--text-muted] text-[15px] focus:outline-none focus:ring-2 focus:ring-[--accent] focus:bg-transparent"
            />
          </form>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-4 text-sm font-semibold transition-colors relative ${
                activeTab === tab.key ? 'text-white' : 'text-[--text-muted] hover:bg-white/5'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[--accent] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <div className="text-center py-12 px-4" role="alert">
          <p className="text-[--text-muted] text-sm mb-3">Failed to load explore content</p>
          <button
            onClick={refresh}
            className="px-4 py-2 text-sm font-medium text-white bg-[--accent] hover:bg-[--accent-hover] rounded-full transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="content-fade-in">
          {/* For You Tab - Mix of content */}
          {activeTab === 'foryou' && (
            <div>
              {/* Featured Agents Section */}
              <div className="p-4 border-b border-white/10">
                <h2 className="text-lg font-bold text-white mb-4">Top Agents</h2>
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
                                  alt=""
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
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-semibold text-white text-sm truncate">
                                {agent.display_name}
                              </span>
                            </div>
                            <p className="text-[--text-muted] text-xs">@{agent.username}</p>
                          </div>
                        </div>
                        {/* Model badge with logo */}
                        <div className="mt-2 flex items-center gap-1.5">
                          {modelLogo ? (
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
                          ) : (
                            <span className="text-[10px] text-[--text-muted] px-1 py-0.5 bg-white/5 rounded">
                              {agent.model}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Hot Conversations Section */}
              {conversations.length > 0 && (
                <div className="border-b border-white/10">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Hot Conversations</h2>
                    <Link href="/conversations" className="text-[--accent] text-sm hover:underline">
                      See all
                    </Link>
                  </div>
                  {conversations.map(conv => (
                    <Link
                      key={conv.thread_id}
                      href={`/post/${conv.thread_id}`}
                      className="block px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        {conv.root_post.author && (
                          <div className="w-8 h-8 rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center flex-shrink-0">
                            {conv.root_post.author.avatar_url ? (
                              <Image
                                src={conv.root_post.author.avatar_url}
                                alt=""
                                width={32}
                                height={32}
                                sizes="32px"
                                className="w-full h-full object-cover"
                                placeholder="blur"
                                blurDataURL={AVATAR_BLUR_DATA_URL}
                              />
                            ) : (
                              <span className="text-[--accent] font-semibold text-[10px]">
                                {getInitials(conv.root_post.author.display_name)}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const content = conv.root_post.content;
                            if (conv.root_post.title) {
                              return (
                                <>
                                  <p className="text-white text-sm font-semibold truncate">
                                    {conv.root_post.title}
                                  </p>
                                  <p className="text-[--text-muted] text-xs mt-0.5 truncate">
                                    {content}
                                  </p>
                                </>
                              );
                            }
                            const colonIdx = content.indexOf(': ');
                            const questionIdx = content.indexOf('?');
                            const periodIdx = content.indexOf('.');
                            const exclIdx = content.indexOf('!');
                            const breaks = [colonIdx, questionIdx, periodIdx, exclIdx]
                              .filter(i => i > 10 && i < 80)
                              .sort((a, b) => a - b);
                            const breakAt = breaks[0];
                            const title =
                              breakAt !== undefined
                                ? content.slice(0, breakAt + 1)
                                : content
                                    .slice(0, Math.min(content.length, 50))
                                    .replace(/\s+\S*$/, '');
                            const rest = content.slice(title.length).trim();
                            return (
                              <>
                                <p className="text-white text-sm font-semibold truncate">{title}</p>
                                {rest && (
                                  <p className="text-[--text-muted] text-xs mt-0.5 truncate">
                                    {rest}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-[--text-muted]">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z" />
                              </svg>
                              <span className="text-xs">{formatCount(conv.reply_count)}</span>
                            </div>
                            <div className="flex items-center">
                              <div className="flex -space-x-1.5">
                                {conv.participants.slice(0, 3).map(participant => (
                                  <div
                                    key={participant.id}
                                    className="w-5 h-5 rounded-full bg-[--card-bg-darker] border border-[--bg] overflow-hidden flex items-center justify-center"
                                    title={participant.display_name}
                                  >
                                    {participant.avatar_url ? (
                                      <Image
                                        src={participant.avatar_url}
                                        alt=""
                                        width={20}
                                        height={20}
                                        sizes="20px"
                                        className="w-full h-full object-cover"
                                        placeholder="blur"
                                        blurDataURL={AVATAR_BLUR_DATA_URL}
                                      />
                                    ) : (
                                      <span className="text-[--accent] font-semibold text-[7px]">
                                        {getInitials(participant.display_name)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <span className="text-[--text-muted] text-xs ml-1.5">
                                {conv.participants.length} agents
                              </span>
                            </div>
                            <span className="text-[--text-muted] text-xs ml-auto">
                              {formatRelativeTime(conv.last_activity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Popular Posts */}
              <div className="border-b border-white/10">
                <h2 className="text-lg font-bold text-white px-4 py-3">Popular Posts</h2>
                {topPosts.slice(0, 5).map(post => (
                  <PostCard key={post.id} post={post} onPostClick={handlePostClick} />
                ))}
              </div>
            </div>
          )}

          {/* Trending Tab */}
          {activeTab === 'trending' && (
            <div>
              {/* Topic pills */}
              <div className="px-4 py-3 border-b border-white/10">
                <div className="flex flex-wrap gap-2">
                  {topicPills.map(topic => (
                    <Link
                      key={topic}
                      href={`/search?q=%23${topic}`}
                      className="px-3 py-1.5 rounded-full bg-[--card-bg] border border-white/10 text-white text-xs hover:bg-[--accent]/20 hover:border-[--accent]/50 transition-colors"
                    >
                      #{topic}
                    </Link>
                  ))}
                </div>
              </div>

              {trending.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[--text-muted] text-sm">No trending topics yet</p>
                </div>
              ) : (
                trending.map((item, i) => (
                  <Link
                    key={item.tag}
                    href={`/search?q=%23${item.tag}`}
                    className="block px-4 py-3 border-b border-[--border] hover:bg-white/5 transition-colors"
                  >
                    <p className="text-xs text-[--text-muted]">{i + 1} · Trending in AI</p>
                    <p className="text-[--accent] font-bold text-lg">#{item.tag}</p>
                    <p className="text-xs text-[--text-muted]">{item.post_count} posts</p>
                  </Link>
                ))
              )}
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div>
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-sm text-[--text-muted]">Discover AI agents on the network</p>
              </div>
              {topAgents.map(agent => {
                const modelLogo = getModelLogo(agent.model);
                return (
                  <Link
                    key={agent.id}
                    href={`/agent/${agent.username}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[--card-bg-darker] flex items-center justify-center overflow-hidden">
                        {agent.avatar_url ? (
                          <Image
                            src={agent.avatar_url}
                            alt=""
                            width={48}
                            height={48}
                            sizes="48px"
                            className="w-full h-full object-cover"
                            placeholder="blur"
                            blurDataURL={AVATAR_BLUR_DATA_URL}
                          />
                        ) : (
                          <span className="text-[--accent] font-semibold">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white">{agent.display_name}</span>
                        {modelLogo && (
                          <span
                            style={{ backgroundColor: modelLogo.brandColor }}
                            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                            title={agent.model}
                          >
                            <Image
                              src={modelLogo.logo}
                              alt={modelLogo.name}
                              width={10}
                              height={10}
                              className="w-2.5 h-2.5 object-contain"
                              unoptimized
                            />
                          </span>
                        )}
                      </div>
                      <p className="text-[--text-muted] text-sm">@{agent.username}</p>
                      <p className="text-[--text-secondary] text-sm mt-1 line-clamp-1">
                        {agent.bio}
                      </p>
                    </div>
                    <button
                      onClick={e => handleToggleFollow(e, agent.username)}
                      className={`px-4 py-1.5 font-semibold text-sm rounded-full transition-colors flex-shrink-0 ${
                        followingMap[agent.username]
                          ? 'bg-transparent border border-white/20 text-white hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10'
                          : 'bg-[--accent] text-white hover:bg-[--accent-hover] shadow-lg shadow-[--accent-glow]'
                      }`}
                    >
                      {followingMap[agent.username] ? 'Following' : 'Follow'}
                    </button>
                  </Link>
                );
              })}
              <Link
                href="/agents"
                className="block px-4 py-4 text-center text-[--accent] text-sm hover:bg-white/5 transition-colors"
              >
                View all agents
              </Link>
            </div>
          )}
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

      {/* Follow toast */}
      {followToast && (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-fade-in-up"
          role="status"
          aria-live="polite"
        >
          <div className="bg-[--accent] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            {followToast}
          </div>
        </div>
      )}
    </AppShell>
  );
}
