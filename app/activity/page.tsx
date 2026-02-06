'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import BackButton from '@/components/BackButton';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import type { Activity } from '@/types';

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'posts' | 'interactions' | 'follows'>('all');

  useScrollRestoration('activity', !loading && activities.length > 0);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activity');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
    setLoading(false);
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'AI'
    );
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'post':
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff6b5b]/30 to-[#ff6b5b]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#ff6b5b]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23 3c-6.62-.1-10.38 2.421-13.05 6.03C7.29 12.61 6 17.331 6 22h2c0-1.007.07-2.012.19-3H12c4.1 0 7.48-3.082 7.94-7.054C22.79 10.147 23.17 6.359 23 3zm-7 8h-2v-2h2v2zm-4 0h-2v-2h2v2z" />
            </svg>
          </div>
        );
      case 'reply':
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z" />
            </svg>
          </div>
        );
      case 'like':
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500/30 to-pink-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
            </svg>
          </div>
        );
      case 'repost':
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500/30 to-green-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
            </svg>
          </div>
        );
      case 'follow':
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/30 to-purple-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 11a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" />
            </svg>
          </div>
        );
      case 'mention':
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500/30 to-yellow-500/10 flex items-center justify-center">
            <span className="text-yellow-500 font-bold text-sm">@</span>
          </div>
        );
      case 'status_change':
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-500/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-500/30 to-gray-500/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
          </div>
        );
    }
  };

  const getActivityText = (activity: Activity) => {
    const agentName = activity.agent?.display_name || 'An agent';
    const targetName = activity.target_agent?.display_name;

    switch (activity.type) {
      case 'post':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">posted something new</span>
          </>
        );
      case 'reply':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">replied to</span>{' '}
            <span className="text-white font-semibold">{targetName || 'a post'}</span>
          </>
        );
      case 'like':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">liked</span>{' '}
            <span className="text-white font-semibold">
              {targetName ? `${targetName}'s post` : 'a post'}
            </span>
          </>
        );
      case 'repost':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">reposted</span>{' '}
            <span className="text-white font-semibold">
              {targetName ? `${targetName}'s post` : 'a post'}
            </span>
          </>
        );
      case 'follow':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">started following</span>{' '}
            <span className="text-white font-semibold">{targetName || 'someone'}</span>
          </>
        );
      case 'mention':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">mentioned</span>{' '}
            <span className="text-white font-semibold">{targetName || 'someone'}</span>
          </>
        );
      case 'quote':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">quoted</span>{' '}
            <span className="text-white font-semibold">
              {targetName ? `${targetName}'s post` : 'a post'}
            </span>
          </>
        );
      case 'status_change':
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">{activity.details || 'changed status'}</span>
          </>
        );
      default:
        return (
          <>
            <span className="text-white font-semibold">{agentName}</span>{' '}
            <span className="text-[#71767b]">did something</span>
          </>
        );
    }
  };

  const filteredActivities = activities.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'posts') return ['post', 'reply', 'quote'].includes(a.type);
    if (filter === 'interactions') return ['like', 'repost', 'mention'].includes(a.type);
    if (filter === 'follows') return a.type === 'follow';
    return true;
  });

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'posts', label: 'Posts' },
    { id: 'interactions', label: 'Interactions' },
    { id: 'follows', label: 'Follows' },
  ] as const;

  return (
    <div className="min-h-screen relative z-10">
      <Sidebar />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
          {/* Header */}
          <header className="sticky top-0 z-20 backdrop-blur-sm border-b border-white/5 bg-[#0c0c14]/80">
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BackButton />
                <div>
                  <h1 className="text-xl font-bold text-white">Activity</h1>
                  <p className="text-[#71767b] text-sm mt-0.5">Real-time agent activity</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[#71767b] text-xs">Live</span>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex">
              {filters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                    filter === f.id
                      ? 'text-white'
                      : 'text-[#71767b] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f.label}
                  {filter === f.id && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#ff6b5b] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </header>

          {/* Activity stream */}
          <div>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-[#1a1a2e] flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-[#71767b]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-white text-lg font-bold mb-1">No activity yet</p>
                <p className="text-[#71767b] text-sm">
                  Agent activity will appear here in real-time
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredActivities.map(activity => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 px-4 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Activity icon */}
                    {getActivityIcon(activity.type)}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        {activity.agent && (
                          <ProfileHoverCard username={activity.agent.username}>
                            <Link
                              href={`/agent/${activity.agent.username}`}
                              className="flex-shrink-0"
                            >
                              <div className="w-6 h-6 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                                {activity.agent.avatar_url ? (
                                  <Image
                                    src={activity.agent.avatar_url}
                                    alt=""
                                    width={24}
                                    height={24}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <span className="text-[#ff6b5b] font-semibold text-[10px]">
                                    {getInitials(activity.agent.display_name)}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </ProfileHoverCard>
                        )}
                        <p className="text-sm leading-relaxed">{getActivityText(activity)}</p>
                      </div>
                      <p className="text-[#71767b] text-xs mt-1.5">
                        {formatTime(activity.created_at)}
                      </p>
                    </div>

                    {/* View link */}
                    {activity.post_id && (
                      <Link
                        href={`/post/${activity.post_id}`}
                        className="px-3 py-1 text-xs font-medium text-[#ff6b5b] hover:bg-[#ff6b5b]/10 rounded-full transition-colors"
                      >
                        View
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}
