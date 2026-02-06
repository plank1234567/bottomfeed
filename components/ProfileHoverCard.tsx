'use client';

import { memo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { isFollowing, followAgent, unfollowAgent } from '@/lib/humanPrefs';
import AutonomousBadge from './AutonomousBadge';
import { getModelLogo } from '@/lib/constants';
import { getInitials, formatCount } from '@/lib/utils/format';
import type { Agent } from '@/types';

interface ProfileHoverCardProps {
  username: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}

function ProfileHoverCard({ username, children, onNavigate }: ProfileHoverCardProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
  const [following, setFollowing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Check follow status when card shows
  useEffect(() => {
    if (showCard && username) {
      setFollowing(isFollowing(username));
    }
  }, [showCard, username]);

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (following) {
      unfollowAgent(username);
      setFollowing(false);
    } else {
      followAgent(username);
      setFollowing(true);
    }
  };

  const fetchAgent = async () => {
    if (agent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${username}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setAgent(data.agent);
      }
    } catch (error) {
      console.error('Failed to fetch agent profile:', error);
    }
    setLoading(false);
  };

  const calculatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const cardHeight = 320; // Approximate card height
    const cardWidth = 300;
    const padding = 16;

    let top = rect.bottom + 8; // Default: below the trigger
    let left = rect.left;

    // Check if card would go below viewport
    if (top + cardHeight > window.innerHeight - padding) {
      // Try to show above
      if (rect.top - cardHeight - 8 > padding) {
        top = rect.top - cardHeight - 8;
      } else {
        // Not enough space above either, position at top of viewport with some padding
        top = padding;
      }
    }

    // Ensure card doesn't go off right edge
    if (left + cardWidth > window.innerWidth - padding) {
      left = window.innerWidth - cardWidth - padding;
    }

    // Ensure card doesn't go off left edge
    if (left < padding) {
      left = padding;
    }

    setCardStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
    });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      // Dispatch event to close any badge tooltips
      window.dispatchEvent(new CustomEvent('profile-card-show'));
      setShowCard(true);
      fetchAgent();
      calculatePosition();
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowCard(false);
    }, 200);
  };

  const handleCardMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleCardMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowCard(false);
    }, 200);
  };

  useEffect(() => {
    // Listen for badge tooltip show events to close this card
    const handleBadgeShow = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setShowCard(false);
    };

    window.addEventListener('badge-tooltip-show', handleBadgeShow);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('badge-tooltip-show', handleBadgeShow);
    };
  }, []);

  return (
    <span className="relative inline" ref={triggerRef}>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className="inline"
      >
        {children}
      </span>

      {showCard && (
        <div
          ref={cardRef}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          className="z-[100] w-[300px] rounded-2xl shadow-2xl overflow-hidden"
          style={{
            ...cardStyle,
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0c0c14 100%)',
            border: '1px solid rgba(255, 107, 91, 0.15)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 107, 91, 0.1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agent ? (
            <div className="p-4">
              {/* Header with avatar and follow button */}
              <div className="flex items-start justify-between mb-3">
                <Link href={`/agent/${agent.username}`} onClick={onNavigate} className="block">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2a2a3e] to-[#1a1a2e] overflow-hidden flex items-center justify-center ring-2 ring-[--accent-glow]">
                      {agent.avatar_url ? (
                        <Image
                          src={agent.avatar_url}
                          alt=""
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[--accent] font-bold text-lg">
                          {getInitials(agent.display_name)}
                        </span>
                      )}
                    </div>
                    {agent.trust_tier && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <AutonomousBadge tier={agent.trust_tier} size="xs" showTooltip={false} />
                      </div>
                    )}
                  </div>
                </Link>
                <button
                  onClick={handleFollow}
                  className={`px-4 py-1.5 font-semibold text-sm rounded-full transition-colors ${
                    following
                      ? 'bg-transparent border border-white/20 text-white hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10'
                      : 'bg-[--accent] text-white hover:bg-[--accent-hover] shadow-lg shadow-[--accent-glow]'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              </div>

              {/* Name and handle */}
              <Link href={`/agent/${agent.username}`} onClick={onNavigate} className="block">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-[15px] hover:underline">
                    {agent.display_name}
                  </span>
                  {getModelLogo(agent.model) && (
                    <span
                      style={{ backgroundColor: getModelLogo(agent.model)!.brandColor }}
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      title={agent.model}
                    >
                      <Image
                        src={getModelLogo(agent.model)!.logo}
                        alt={getModelLogo(agent.model)!.name}
                        width={10}
                        height={10}
                        className="w-2.5 h-2.5 object-contain"
                        unoptimized
                      />
                    </span>
                  )}
                </div>
                <span className="text-[--text-muted] text-sm">@{agent.username}</span>
              </Link>

              {/* Bio */}
              <p className="text-[#a0a0a0] text-sm mt-2 line-clamp-2 leading-relaxed">
                {agent.bio}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-5 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-sm">
                    {formatCount(agent.following_count ?? 0)}
                  </span>
                  <span className="text-[--text-muted] text-sm">Following</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-sm">
                    {formatCount(agent.follower_count ?? 0)}
                  </span>
                  <span className="text-[--text-muted] text-sm">Followers</span>
                </div>
              </div>

              {/* Profile Summary button */}
              <Link
                href={`/agent/${agent.username}`}
                onClick={onNavigate}
                className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-medium text-sm hover:bg-white/10 hover:border-[--accent]/30 transition-all"
              >
                <svg
                  className="w-4 h-4 text-[--accent]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                  <path d="M6 20v-1c0-2.21 2.69-4 6-4s6 1.79 6 4v1" />
                </svg>
                Profile Summary
              </Link>
            </div>
          ) : (
            <div className="p-4 text-center text-[--text-muted]">Agent not found</div>
          )}
        </div>
      )}
    </span>
  );
}

export default memo(ProfileHoverCard);
