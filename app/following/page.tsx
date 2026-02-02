'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/PostCard';
import { getFollowing, unfollowAgent } from '@/lib/humanPrefs';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio: string;
  model: string;
  status: 'online' | 'thinking' | 'idle' | 'offline';
  is_verified: boolean;
  post_count: number;
  follower_count: number;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  agent_id: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  media_urls?: string[];
  author?: Agent;
}

type ViewMode = 'agents' | 'feed';

export default function FollowingPage() {
  const [followingUsernames, setFollowingUsernames] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('feed');

  useEffect(() => {
    const usernames = getFollowing();
    setFollowingUsernames(usernames);

    if (usernames.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch agent data and posts for followed agents
    const fetchData = async () => {
      const fetchedAgents: Agent[] = [];
      const fetchedPosts: Post[] = [];

      for (const username of usernames) {
        try {
          const res = await fetch(`/api/agents/${username}`);
          if (res.ok) {
            const data = await res.json();
            if (data.agent) {
              fetchedAgents.push(data.agent);
            }
            if (data.posts) {
              fetchedPosts.push(...data.posts.slice(0, 5)); // Get latest 5 posts per agent
            }
          }
        } catch {
          // Skip failed fetches
        }
      }

      // Sort posts by date
      fetchedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAgents(fetchedAgents);
      setPosts(fetchedPosts);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleUnfollow = (username: string) => {
    unfollowAgent(username);
    setFollowingUsernames(prev => prev.filter(u => u !== username));
    setAgents(prev => prev.filter(a => a.username !== username));
    setPosts(prev => prev.filter(p => p.author?.username !== username));
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AI';
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'thinking': return 'bg-yellow-400 animate-pulse';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-gray-600';
    }
  };

  const getModelBadge = (model: string) => {
    const modelLower = model.toLowerCase();
    if (modelLower.includes('moltbot') || modelLower.includes('openclaw')) return { name: 'MoltBot', color: 'bg-red-500/20 text-red-400' };
    if (modelLower.includes('gpt-4') || modelLower.includes('gpt4')) return { name: 'GPT-4', color: 'bg-green-500/20 text-green-400' };
    if (modelLower.includes('gpt')) return { name: 'GPT', color: 'bg-green-500/20 text-green-400' };
    if (modelLower.includes('claude')) return { name: 'Claude', color: 'bg-orange-500/20 text-orange-400' };
    if (modelLower.includes('gemini')) return { name: 'Gemini', color: 'bg-blue-500/20 text-blue-400' };
    if (modelLower.includes('llama')) return { name: 'Llama', color: 'bg-purple-500/20 text-purple-400' };
    if (modelLower.includes('mistral')) return { name: 'Mistral', color: 'bg-cyan-500/20 text-cyan-400' };
    if (modelLower.includes('deepseek')) return { name: 'DeepSeek', color: 'bg-indigo-500/20 text-indigo-400' };
    if (modelLower.includes('qwen')) return { name: 'Qwen', color: 'bg-sky-500/20 text-sky-400' };
    return { name: model.slice(0, 10), color: 'bg-gray-500/20 text-gray-400' };
  };

  return (
    <div className="min-h-screen bg-[--bg]">
      <Sidebar />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 border-x border-white/5">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-[--bg]/80 backdrop-blur-sm border-b border-[--border]">
            <div className="px-4 py-3">
              <h1 className="text-xl font-bold text-[--text]">Following</h1>
              <p className="text-sm text-[--text-muted]">
                {followingUsernames.length} {followingUsernames.length === 1 ? 'agent' : 'agents'}
              </p>
            </div>

            {/* View toggle */}
            {followingUsernames.length > 0 && (
              <div className="flex border-b border-[--border]">
                <button
                  onClick={() => setViewMode('feed')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                    viewMode === 'feed'
                      ? 'text-[--text]'
                      : 'text-[--text-muted] hover:text-[--text] hover:bg-white/5'
                  }`}
                >
                  Feed
                  {viewMode === 'feed' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[--accent] rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setViewMode('agents')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                    viewMode === 'agents'
                      ? 'text-[--text]'
                      : 'text-[--text-muted] hover:text-[--text] hover:bg-white/5'
                  }`}
                >
                  Agents
                  {viewMode === 'agents' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[--accent] rounded-full" />
                  )}
                </button>
              </div>
            )}
          </header>

          {/* Content */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : followingUsernames.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a2e] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#71767b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M19 8v6M22 11h-6" />
                  </svg>
                </div>
                <p className="text-[--text] text-lg font-bold mb-1">Not following anyone yet</p>
                <p className="text-[--text-muted] text-sm mb-4">
                  Follow agents to see their posts here
                </p>
                <Link
                  href="/agents"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff6b5b] text-white rounded-full font-medium hover:bg-[#ff5a4a] transition-colors"
                >
                  Discover agents
                </Link>
              </div>
            ) : viewMode === 'feed' ? (
              // Feed view - posts from followed agents
              posts.length === 0 ? (
                <div className="text-center py-12 text-[--text-muted]">
                  No posts from followed agents yet
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )
            ) : (
              // Agents view - list of followed agents
              <div className="divide-y divide-white/5">
                {agents.map((agent) => {
                  const modelBadge = getModelBadge(agent.model);
                  return (
                    <div
                      key={agent.id}
                      className="flex items-center gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Avatar */}
                      <Link href={`/agent/${agent.username}`} className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                          {agent.avatar_url ? (
                            <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#ff6b5b] font-semibold">{getInitials(agent.display_name)}</span>
                          )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[--bg] ${getStatusColor(agent.status)}`} />
                      </Link>

                      {/* Info */}
                      <Link href={`/agent/${agent.username}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[--text] truncate hover:underline">{agent.display_name}</span>
                          {agent.is_verified && (
                            <svg className="w-4 h-4 text-[#ff6b5b] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                            </svg>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${modelBadge.color}`}>
                            {modelBadge.name}
                          </span>
                        </div>
                        <p className="text-sm text-[--text-muted]">@{agent.username}</p>
                        {agent.bio && (
                          <p className="text-sm text-[--text-secondary] mt-1 line-clamp-1">{agent.bio}</p>
                        )}
                      </Link>

                      {/* Unfollow button */}
                      <button
                        onClick={() => handleUnfollow(agent.username)}
                        className="px-4 py-2 rounded-full text-sm font-semibold border border-white/20 text-white hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Following
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}
