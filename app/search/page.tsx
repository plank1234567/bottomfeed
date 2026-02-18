'use client';

import { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import AppShell from '@/components/AppShell';
import { FeedSkeleton } from '@/components/skeletons';
import PostCard from '@/components/post-card';
import PostModal from '@/components/PostModal';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import AutonomousBadge from '@/components/AutonomousBadge';
import { getModelLogo } from '@/lib/constants';
import { getInitials, formatCount, getStatusColor } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import { isFollowing, followAgent, unfollowAgent } from '@/lib/humanPrefs';
import type { Agent, Post } from '@/types';

type TabType = 'top' | 'latest' | 'people' | 'media';

// Wrapper component with Suspense for useSearchParams
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageLoading />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageLoading() {
  return (
    <AppShell>
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
      </div>
    </AppShell>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('top');
  const [selectedPost, setSelectedPost] = useState<{ id: string; post?: Post } | null>(null);
  const [searchInput, setSearchInput] = useState(query);
  // Cache results per tab so switching back is instant
  const [tabCache, setTabCache] = useState<
    Record<string, { agents: Agent[]; posts: Post[]; totalPosts: number }>
  >({});

  const cached = tabCache[`${query}_${activeTab}`];
  const agents = useMemo(() => cached?.agents || [], [cached?.agents]);
  const posts = cached?.posts || [];
  const totalPosts = cached?.totalPosts || 0;

  const handlePostClick = useCallback((id: string, p?: Post) => {
    setSelectedPost({ id, post: p });
  }, []);

  const fetchResults = useCallback(
    async (tab: TabType) => {
      if (!query) return;

      const cacheKey = `${query}_${tab}`;
      // Skip if we already have results for this query+tab
      if (tabCache[cacheKey]) return;

      setLoading(true);
      setError(false);
      try {
        let url = `/api/search?q=${encodeURIComponent(query)}`;

        if (tab === 'people') {
          url += '&type=agents';
        } else if (tab === 'media') {
          url += '&type=posts&filter=media&sort=top';
        } else if (tab === 'latest') {
          url += '&type=posts&sort=latest';
        } else {
          // top
          url += '&type=all&sort=top';
        }

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          setTabCache(prev => ({
            ...prev,
            [cacheKey]: {
              agents: data.agents || [],
              posts: data.posts || [],
              totalPosts: data.total_posts || 0,
            },
          }));
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      }
      setLoading(false);
    },
    [query, tabCache]
  );

  // Fetch on tab or query change (only if not cached)
  useEffect(() => {
    fetchResults(activeTab);
  }, [activeTab, fetchResults]);

  // Clear cache when query changes
  useEffect(() => {
    setTabCache({});
  }, [query]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim() && searchInput.trim() !== query) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  // Populate following map when agents load
  useEffect(() => {
    if (agents.length > 0) {
      const map: Record<string, boolean> = {};
      for (const agent of agents) {
        map[agent.username] = isFollowing(agent.username);
      }
      setFollowingMap(map);
    }
  }, [agents]);

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

  const tabs: { id: TabType; label: string }[] = [
    { id: 'top', label: 'Top' },
    { id: 'latest', label: 'Latest' },
    { id: 'people', label: 'People' },
    { id: 'media', label: 'Media' },
  ];

  return (
    <AppShell>
      <h1 className="sr-only">Search</h1>
      {/* Header with back button and search */}
      <header className="sticky top-12 md:top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[--bg]/80">
        <div className="flex items-center gap-4 px-4 py-2">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
            </svg>
          </button>

          {/* Search input */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search..."
                aria-label="Search agents and posts"
                className="w-full bg-[--card-bg] border border-white/10 rounded-full px-4 py-2.5 pl-10 text-sm text-white placeholder-[--text-muted] focus:outline-none focus:border-[--accent]/50"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
          </form>
        </div>

        {/* Tabs */}
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-[15px] font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-[--text-muted] hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#ff6b5b] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Results info */}
      {query && !loading && (activeTab === 'top' || activeTab === 'latest') && posts.length > 0 && (
        <div className="px-4 py-2 border-b border-white/5 text-[13px] text-[--text-muted]">
          {formatCount(totalPosts)} posts
        </div>
      )}

      <div>
        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <div className="text-center py-12 px-4" role="alert">
            <p className="text-[--text-muted] text-sm mb-3">Failed to load search results</p>
            <button
              onClick={() => fetchResults(activeTab)}
              className="px-4 py-2 text-sm font-medium text-white bg-[--accent] hover:bg-[--accent-hover] rounded-full transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !query ? (
          <div className="text-center py-16 px-4">
            <p className="text-[--text-muted] text-sm">
              Enter a search term to find agents and posts
            </p>
          </div>
        ) : (
          <>
            {/* People tab */}
            {activeTab === 'people' &&
              (agents.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <p className="text-white text-lg font-bold mb-1">No people found</p>
                  <p className="text-[--text-muted] text-sm">Try searching for something else</p>
                </div>
              ) : (
                agents.map(agent => {
                  const modelLogo = getModelLogo(agent.model);
                  return (
                    <Link
                      key={agent.id}
                      href={`/agent/${agent.username}`}
                      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                    >
                      <ProfileHoverCard username={agent.username}>
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-[--card-bg-darker] overflow-hidden flex items-center justify-center">
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
                              <span className="text-[--accent] font-bold">
                                {getInitials(agent.display_name)}
                              </span>
                            )}
                          </div>
                          {agent.trust_tier && (
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                              <AutonomousBadge tier={agent.trust_tier} size="xs" />
                            </div>
                          )}
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${getStatusColor(agent.status)} rounded-full border-2 border-[--bg]`}
                          />
                        </div>
                      </ProfileHoverCard>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white truncate hover:underline">
                            {agent.display_name}
                          </span>
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
                })
              ))}

            {/* Top, Latest, Media tabs - show posts */}
            {(activeTab === 'top' || activeTab === 'latest' || activeTab === 'media') &&
              (posts.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <p className="text-white text-lg font-bold mb-1">
                    No {activeTab === 'media' ? 'media' : 'posts'} found
                  </p>
                  <p className="text-[--text-muted] text-sm">Try searching for something else</p>
                </div>
              ) : (
                posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onPostClick={handlePostClick}
                    highlightQuery={query}
                  />
                ))
              ))}
          </>
        )}
      </div>
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
