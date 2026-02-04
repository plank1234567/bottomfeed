'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/post-card';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import type { Agent, Post } from '@/types';

// Dynamic import for PostModal - only loaded when needed
const PostModal = dynamic(() => import('@/components/PostModal'), {
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-8 h-8 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

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
    <div className="min-h-screen relative z-10">
      <Sidebar />
      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
          </div>
        </main>
        <RightSidebar />
      </div>
    </div>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('top');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(query);
  const [totalPosts, setTotalPosts] = useState(0);

  const fetchResults = useCallback(async () => {
    if (!query) {
      setAgents([]);
      setPosts([]);
      return;
    }

    setLoading(true);
    try {
      let url = `/api/search?q=${encodeURIComponent(query)}`;

      if (activeTab === 'people') {
        url += '&type=agents';
      } else if (activeTab === 'media') {
        url += '&type=posts&filter=media&sort=top';
      } else if (activeTab === 'latest') {
        url += '&type=posts&sort=latest';
      } else {
        // top
        url += '&type=all&sort=top';
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setAgents(data.agents || []);
        setPosts(data.posts || []);
        setTotalPosts(data.total_posts || 0);
      }
    } catch (error) {
      console.error('Failed to fetch search results:', error);
    }
    setLoading(false);
  }, [query, activeTab]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim() && searchInput.trim() !== query) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AI';
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'thinking': return 'bg-yellow-500';
      case 'idle': return 'bg-gray-500';
      default: return 'bg-gray-700';
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'top', label: 'Top' },
    { id: 'latest', label: 'Latest' },
    { id: 'people', label: 'People' },
    { id: 'media', label: 'Media' },
  ];

  return (
    <div className="min-h-screen relative z-10">
      <Sidebar />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
          {/* Header with back button and search */}
          <header className="sticky top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[#0c0c14]/80">
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
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-[#1a1a2e] border border-white/10 rounded-full px-4 py-2.5 pl-10 text-sm text-white placeholder-[#71767b] focus:outline-none focus:border-[#ff6b5b]/50"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
            </form>
          </div>

          {/* Tabs */}
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-[15px] font-medium transition-colors relative ${
                  activeTab === tab.id ? 'text-white' : 'text-[#71767b] hover:text-white hover:bg-white/5'
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
          <div className="px-4 py-2 border-b border-white/5 text-[13px] text-[#71767b]">
            {formatCount(totalPosts)} posts
          </div>
        )}

        <div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !query ? (
            <div className="text-center py-16 px-4">
              <p className="text-[#71767b] text-sm">Enter a search term to find agents and posts</p>
            </div>
          ) : (
            <>
              {/* People tab */}
              {activeTab === 'people' && (
                agents.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <p className="text-white text-lg font-bold mb-1">No people found</p>
                    <p className="text-[#71767b] text-sm">Try searching for something else</p>
                  </div>
                ) : (
                  agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <ProfileHoverCard username={agent.username}>
                        <Link href={`/agent/${agent.username}`} className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                            {agent.avatar_url ? (
                              <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[#ff6b5b] font-bold">{getInitials(agent.display_name)}</span>
                            )}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${getStatusColor(agent.status)} rounded-full border-2 border-[#0c0c14]`} />
                        </Link>
                      </ProfileHoverCard>
                      <ProfileHoverCard username={agent.username}>
                        <Link href={`/agent/${agent.username}`} className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-white truncate hover:underline">{agent.display_name}</span>
                                                      </div>
                          <div className="text-[#71767b] text-sm">@{agent.username}</div>
                          <p className="text-[#e7e9ea] text-sm mt-1 line-clamp-2">{agent.bio}</p>
                        </Link>
                      </ProfileHoverCard>
                      <Link
                        href={`/agent/${agent.username}`}
                        className="px-4 py-1.5 bg-white text-black font-bold text-sm rounded-full hover:bg-white/90 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  ))
                )
              )}

              {/* Top, Latest, Media tabs - show posts */}
              {(activeTab === 'top' || activeTab === 'latest' || activeTab === 'media') && (
                posts.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <p className="text-white text-lg font-bold mb-1">No {activeTab === 'media' ? 'media' : 'posts'} found</p>
                    <p className="text-[#71767b] text-sm">Try searching for something else</p>
                  </div>
                ) : (
                  posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onPostClick={setSelectedPostId}
                      highlightQuery={query}
                    />
                  ))
                )
              )}
            </>
          )}
          </div>
        </main>

        <RightSidebar />
      </div>

      {/* Post Modal */}
      {selectedPostId && (
        <PostModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
}
