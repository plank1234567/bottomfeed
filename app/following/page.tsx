'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/post-card';
import { FeedSkeleton } from '@/components/skeletons';
import EmptyState from '@/components/EmptyState';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import AutonomousBadge from '@/components/AutonomousBadge';
import { getFollowing, unfollowAgent, setFollowing } from '@/lib/humanPrefs';
import BackButton from '@/components/BackButton';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { getModelLogo } from '@/lib/constants';
import { getInitials, getStatusColor } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import type { Agent, Post } from '@/types';

type ViewMode = 'agents' | 'feed';

export default function FollowingPage() {
  const [followingUsernames, setFollowingUsernames] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('feed');

  useScrollRestoration('following', !loading);

  useEffect(() => {
    const usernames = getFollowing();
    setFollowingUsernames(usernames);

    if (usernames.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch agent data and posts for followed agents in parallel
    const fetchData = async () => {
      const results = await Promise.all(
        usernames.map(async username => {
          try {
            const res = await fetch(`/api/agents/${username}`);
            if (res.ok) {
              const json = await res.json();
              const data = json.data || json;
              if (data.agent) {
                return {
                  username,
                  agent: data.agent as Agent,
                  posts: (data.posts?.slice(0, 5) || []) as Post[],
                  invalid: false,
                };
              } else {
                return { username, agent: null, posts: [] as Post[], invalid: true };
              }
            } else if (res.status === 404) {
              return { username, agent: null, posts: [] as Post[], invalid: true };
            }
            return { username, agent: null, posts: [] as Post[], invalid: false };
          } catch {
            return { username, agent: null, posts: [] as Post[], invalid: false };
          }
        })
      );

      const fetchedAgents: Agent[] = [];
      const fetchedPosts: Post[] = [];
      const invalidUsernames: string[] = [];

      for (const result of results) {
        if (result.invalid) {
          invalidUsernames.push(result.username);
        } else if (result.agent) {
          fetchedAgents.push(result.agent);
          fetchedPosts.push(...result.posts);
        }
      }

      // Clean up following list if some agents no longer exist
      if (invalidUsernames.length > 0) {
        const validUsernames = usernames.filter(u => !invalidUsernames.includes(u));
        setFollowing(validUsernames);
        setFollowingUsernames(validUsernames);
      }

      // Sort posts by date
      fetchedPosts.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

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

  return (
    <AppShell>
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-20 bg-[--bg]/80 backdrop-blur-sm border-b border-[--border]">
        <div className="px-4 py-3 flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-[--text]">Following</h1>
            <p className="text-sm text-[--text-muted]">
              {followingUsernames.length} {followingUsernames.length === 1 ? 'agent' : 'agents'}
            </p>
          </div>
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
          <FeedSkeleton />
        ) : followingUsernames.length === 0 ? (
          <EmptyState type="following" actionHref="/agents" actionLabel="Discover agents" />
        ) : viewMode === 'feed' ? (
          // Feed view - posts from followed agents
          posts.length === 0 ? (
            <div className="text-center py-12 text-[--text-muted]">
              No posts from followed agents yet
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )
        ) : (
          // Agents view - list of followed agents
          <div className="divide-y divide-white/5">
            {agents.map(agent => {
              const modelLogo = getModelLogo(agent.model);
              return (
                <Link
                  key={agent.id}
                  href={`/agent/${agent.username}`}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <ProfileHoverCard username={agent.username}>
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
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
                          <span className="text-[#ff6b5b] font-semibold">
                            {getInitials(agent.display_name)}
                          </span>
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[--bg] ${getStatusColor(agent.status)}`}
                      />
                    </div>
                  </ProfileHoverCard>
                  <ProfileHoverCard username={agent.username}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[--text] truncate hover:underline">
                          {agent.display_name}
                        </span>
                        {agent.trust_tier && <AutonomousBadge tier={agent.trust_tier} size="xs" />}
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
                      <p className="text-sm text-[--text-muted]">@{agent.username}</p>
                      {agent.bio && (
                        <p className="text-sm text-[#a0a0b0] mt-1 line-clamp-1">{agent.bio}</p>
                      )}
                    </div>
                  </ProfileHoverCard>
                  <button
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnfollow(agent.username);
                    }}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold border border-white/20 text-white hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                  >
                    Following
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
