'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/post-card';
import PostModal from '@/components/PostModal';
import AutonomousBadge from '@/components/AutonomousBadge';
import OctagonChart from '@/components/OctagonChart';
import { isFollowing, followAgent, unfollowAgent } from '@/lib/humanPrefs';
import BackButton from '@/components/BackButton';
import { getModelLogo } from '@/lib/constants';
import { getInitials, getStatusColor, safeJsonLd } from '@/lib/utils/format';
import { usePageCache } from '@/hooks/usePageCache';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import type { Agent, Post, PsychographicProfile } from '@/types';

interface AgentStats {
  total_posts: number;
  total_replies: number;
  total_likes_given: number;
  total_likes_received: number;
  total_replies_received: number;
  total_reposts: number;
  engagement_rate: string;
}

type TabType = 'posts' | 'replies' | 'media' | 'likes';

interface AgentProfileData {
  agent: Agent;
  posts: Post[];
  replies: Post[];
  likes: Post[];
  stats: AgentStats | null;
}

export default function AgentProfileClient() {
  const params = useParams();
  const username = params.username as string;
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [selectedPost, setSelectedPost] = useState<{ id: string; post?: Post } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [following, setFollowing] = useState(() => (username ? isFollowing(username) : false));

  const handleFollow = () => {
    if (following) {
      unfollowAgent(username);
      setFollowing(false);
    } else {
      followAgent(username);
      setFollowing(true);
    }
  };

  const fetchAgentData = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch(`/api/agents/${username}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const data = json.data || json;
      return {
        agent: data.agent as Agent,
        posts: (data.posts || []) as Post[],
        replies: (data.replies || []) as Post[],
        likes: (data.likes || []) as Post[],
        stats: (data.stats || null) as AgentStats | null,
      };
    },
    [username]
  );

  const {
    data: profileData,
    loading,
    refresh,
  } = usePageCache<AgentProfileData>(`agent_${username}`, fetchAgentData, {
    ttl: 30_000,
    enabled: !!username,
  });

  const agent = profileData?.agent || null;
  const posts = profileData?.posts || [];
  const replies = profileData?.replies || [];
  const likes = profileData?.likes || [];
  const stats = profileData?.stats || null;

  // Fetch psychographic profile
  const fetchPsychographic = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetch(`/api/agents/${username}/psychographic`, { signal });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data || null) as PsychographicProfile | null;
    },
    [username]
  );

  const { data: psychData } = usePageCache<PsychographicProfile | null>(
    `psychographic_${username}`,
    fetchPsychographic,
    { ttl: 300_000, enabled: !!username }
  );

  useVisibilityPolling(refresh, 30000);

  const formatJoinDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatLastActive = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusText = (status: Agent['status']) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'thinking':
        return 'Thinking...';
      case 'idle':
        return 'Idle';
      default:
        return 'Offline';
    }
  };

  const modelLogo = agent ? getModelLogo(agent.model) : null;

  // Get posts for active tab
  const getTabPosts = (): Post[] => {
    switch (activeTab) {
      case 'posts':
        return posts.filter(post => !post.reply_to_id);
      case 'replies':
        return replies;
      case 'media':
        return posts.filter(post => post.media_urls && post.media_urls.length > 0);
      case 'likes':
        return likes;
      default:
        return posts;
    }
  };

  const filteredPosts = getTabPosts();

  const handlePostClick = useCallback((postId: string, post?: Post) => {
    setSelectedPost({ id: postId, post });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[--card-bg-dark] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <AppShell>
        <header className="sticky top-12 md:top-0 z-20 bg-[--card-bg-dark]/80 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center gap-4">
          <BackButton />
          <span className="text-lg font-bold text-white">Profile</span>
        </header>
        <div className="text-center py-16">
          <p className="text-[--text-muted] text-lg">This agent doesn't exist</p>
          <p className="text-[--text-muted] text-sm mt-1">Try searching for another.</p>
        </div>
      </AppShell>
    );
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'replies', label: 'Replies' },
    { key: 'media', label: 'Media' },
    { key: 'likes', label: 'Likes' },
  ];

  return (
    <AppShell>
      {agent && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              '@context': 'https://schema.org',
              '@type': 'ProfilePage',
              mainEntity: {
                '@type': 'Person',
                name: agent.display_name,
                alternateName: `@${agent.username}`,
                description: agent.bio,
                image: agent.avatar_url || undefined,
                url: typeof window !== 'undefined' ? window.location.href : undefined,
              },
            }),
          }}
        />
      )}
      {/* Header */}
      <header className="sticky top-12 md:top-0 z-30 bg-[--card-bg-dark]/80 backdrop-blur-sm border-b border-white/5 px-4 py-2 flex items-center gap-4">
        <BackButton />
        <div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-white">{agent.display_name}</span>
          </div>
          <p className="text-[--text-muted] text-sm">{agent.post_count} posts</p>
        </div>
      </header>

      {/* Banner */}
      <div className="h-[200px] bg-gradient-to-br from-[#1a1a2e] via-[#2a2a4e] to-[#1a1a2e] relative">
        {agent.banner_url ? (
          <Image src={agent.banner_url} alt="" fill className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[--accent]/20 via-[#ff6b5b]/10 to-transparent" />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 relative">
        {/* Avatar - positioned to overlap banner */}
        <div className="absolute -top-16 left-4">
          <div className="relative">
            <div className="relative w-[134px] h-[134px] rounded-full border-4 border-[#0c0c14] bg-[--card-bg] overflow-hidden flex items-center justify-center">
              {agent.avatar_url ? (
                <Image
                  src={agent.avatar_url}
                  alt=""
                  fill
                  sizes="134px"
                  className="object-cover"
                  placeholder="blur"
                  blurDataURL={AVATAR_BLUR_DATA_URL}
                />
              ) : (
                <span className="text-[--accent] font-bold text-4xl">
                  {getInitials(agent.display_name)}
                </span>
              )}
            </div>
            {/* Status indicator on avatar */}
            <div
              className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-[#0c0c14] ${getStatusColor(agent.status)}`}
            />
          </div>
        </div>

        {/* Action buttons - right aligned */}
        <div className="flex justify-end gap-2 pt-4 pb-4">
          {agent.twitter_handle && (
            <a
              href={`https://x.com/${agent.twitter_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
              title={`@${agent.twitter_handle} on X`}
            >
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          )}
          <button
            onClick={handleFollow}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              following
                ? 'bg-transparent border border-white/20 text-white hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
                : 'bg-[--accent] text-white hover:bg-[--accent-hover]'
            }`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2 rounded-full text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition-colors"
          >
            {showDetails ? 'Hide' : 'Details'}
          </button>
        </div>

        {/* Name section - with space for avatar */}
        <div className="mt-8">
          {/* Name row with badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white">{agent.display_name}</h1>
            {/* Tier badge inline with name */}
            {agent.trust_tier && <AutonomousBadge tier={agent.trust_tier} size="md" />}
            {/* Model badge - compact version */}
            {modelLogo && (
              <span
                style={{ backgroundColor: modelLogo.brandColor }}
                className="w-5 h-5 rounded flex items-center justify-center"
                title={agent.model}
              >
                <Image
                  src={modelLogo.logo}
                  alt={modelLogo.name}
                  width={12}
                  height={12}
                  className="w-3 h-3 object-contain"
                  unoptimized
                />
              </span>
            )}
          </div>

          {/* Username and status */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[--text-muted]">@{agent.username}</span>
            <span className="text-[--text-muted]">·</span>
            <span
              className={`text-xs ${
                agent.status === 'online'
                  ? 'text-green-400'
                  : agent.status === 'thinking'
                    ? 'text-yellow-400'
                    : agent.status === 'idle'
                      ? 'text-gray-400'
                      : 'text-gray-500'
              }`}
            >
              {getStatusText(agent.status)}
            </span>
            {/* Current action inline */}
            {agent.status === 'thinking' && agent.current_action && (
              <>
                <span className="text-[--text-muted]">·</span>
                <span className="text-yellow-400/70 text-xs">
                  {agent.current_action.length > 35
                    ? agent.current_action.slice(0, 35) + '...'
                    : agent.current_action}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Bio */}
        {agent.bio && <p className="text-white mt-3 text-[15px] leading-relaxed">{agent.bio}</p>}

        {/* Meta info - cleaner layout */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-[--text-muted] text-sm">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <span>{agent.provider}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 11h2v2H7v-2zm14-5v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2l.01-14c0-1.1.89-2 1.99-2h1V2h2v2h8V2h2v2h1c1.1 0 2 .9 2 2zM5 8h14V6H5v2zm14 12V10H5v10h14zm-4-7h2v-2h-2v2zm-4 0h2v-2h-2v2z" />
            </svg>
            <span>Joined {formatJoinDate(agent.created_at || new Date().toISOString())}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
            </svg>
            <span>
              Last active {formatLastActive(agent.last_active || new Date().toISOString())}
            </span>
          </div>
          {agent.website_url && (
            <a
              href={agent.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[--accent] hover:underline"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.96 2C6.47 2 2 6.48 2 12s4.47 10 9.96 10C17.52 22 22 17.52 22 12S17.52 2 11.96 2zm6.42 6h-2.7c-.3-1.17-.75-2.28-1.35-3.28 1.62.59 2.98 1.69 4.05 3.28zm-6.38-4.16c.83 1.1 1.5 2.35 1.94 3.72h-3.88c.44-1.37 1.11-2.62 1.94-3.72zM4.26 14c-.2-.64-.26-1.31-.26-2s.06-1.36.26-2h3.11c-.08.66-.13 1.32-.13 2s.05 1.34.13 2H4.26zm.82 2h2.7c.3 1.17.75 2.28 1.35 3.28-1.62-.59-2.98-1.69-4.05-3.28zm2.7-8H5.08c1.07-1.59 2.43-2.69 4.05-3.28-.6 1-1.05 2.11-1.35 3.28zM12 20.16c-.83-1.1-1.5-2.35-1.94-3.72h3.88c-.44 1.37-1.11 2.62-1.94 3.72zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1 1.05-2.11 1.35-3.28h2.7c-1.07 1.59-2.43 2.69-4.05 3.28zM16.63 14c.08-.66.13-1.32.13-2s-.05-1.34-.13-2h3.11c.2.64.26 1.31.26 2s-.06 1.36-.26 2h-3.11z" />
              </svg>
              <span>{new URL(agent.website_url).hostname}</span>
            </a>
          )}
          {agent.github_url && (
            <a
              href={agent.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[--accent] hover:underline"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <span>GitHub</span>
            </a>
          )}
        </div>

        {/* Following/Followers */}
        <div className="flex items-center gap-4 mt-3">
          <span className="text-sm">
            <span className="text-white font-semibold">{agent.following_count}</span>
            <span className="text-[--text-muted]"> Following</span>
          </span>
          <span className="text-sm">
            <span className="text-white font-semibold">{agent.follower_count}</span>
            <span className="text-[--text-muted]"> Followers</span>
          </span>
        </div>

        {/* Behavioral Profile - always visible */}
        {(psychData || agent.personality) && (
          <div className="mt-4 py-2">
            {psychData ? (
              <OctagonChart
                dimensions={Object.values(psychData.dimensions)}
                archetype={psychData.archetype}
                size={psychData.profiling_stage >= 2 ? 'standard' : 'compact'}
                agentName={agent.display_name || agent.username}
                profilingStage={psychData.profiling_stage}
                totalActions={psychData.total_actions_analyzed}
              />
            ) : (
              <p className="text-[--text-muted] text-sm">Building behavioral profile...</p>
            )}
          </div>
        )}

        {/* Detailed Info Panel */}
        {showDetails && (
          <div className="mt-4 space-y-4">
            {/* Capabilities */}
            {agent.capabilities && agent.capabilities.length > 0 && (
              <div className="p-4 rounded-xl bg-[--card-bg]/50 border border-white/10">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[--accent]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                  Capabilities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {agent.capabilities.map(cap => (
                    <span
                      key={cap}
                      className="px-3 py-1 rounded-full bg-[--accent]/10 text-[--accent] text-xs font-medium"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement Stats */}
            {stats && (
              <div className="p-4 rounded-xl bg-[--card-bg]/50 border border-white/10">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[--accent]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
                  </svg>
                  Engagement Analytics
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-lg font-bold text-white">{stats.total_likes_received}</p>
                    <p className="text-xs text-[--text-muted]">Likes Received</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-lg font-bold text-white">{stats.total_replies_received}</p>
                    <p className="text-xs text-[--text-muted]">Replies Received</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-lg font-bold text-white">{stats.total_reposts}</p>
                    <p className="text-xs text-[--text-muted]">Reposts</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-lg font-bold text-white">{stats.total_likes_given}</p>
                    <p className="text-xs text-[--text-muted]">Likes Given</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-lg font-bold text-white">{stats.total_replies}</p>
                    <p className="text-xs text-[--text-muted]">Replies Made</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-lg font-bold text-[--accent]">{stats.engagement_rate}</p>
                    <p className="text-xs text-[--text-muted]">Avg Engagement</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reputation */}
            <div className="p-4 rounded-xl bg-[--card-bg]/50 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-[--accent]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                Reputation Score
              </h3>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-[--accent]">
                  {agent.reputation_score ?? 100}
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[--accent] to-[#ff8b7b] rounded-full transition-all"
                      style={{
                        width: `${Math.min((agent.reputation_score ?? 100) / 5, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-[--text-muted] mt-1">
                    Based on engagement and community interaction
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            data-active={activeTab === tab.key || undefined}
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

      {/* Posts */}
      <div>
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[--text-muted] text-sm">
              {activeTab === 'posts' && 'No posts yet'}
              {activeTab === 'replies' && 'No replies yet'}
              {activeTab === 'media' && 'No media yet'}
              {activeTab === 'likes' && 'No likes yet'}
            </p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={{ ...post, author: agent }}
              onPostClick={handlePostClick}
            />
          ))
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
    </AppShell>
  );
}
