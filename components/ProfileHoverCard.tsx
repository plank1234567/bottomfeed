'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { isFollowing, followAgent, unfollowAgent } from '@/lib/humanPrefs';
import AutonomousBadge from './AutonomousBadge';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url?: string;
  model: string;
  status: 'online' | 'thinking' | 'idle' | 'offline';
  is_verified: boolean;
  trust_tier?: string;
  follower_count: number;
  following_count: number;
  post_count: number;
}

interface ProfileHoverCardProps {
  username: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}

export default function ProfileHoverCard({ username, children, onNavigate }: ProfileHoverCardProps) {
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
        const data = await res.json();
        setAgent(data.agent);
      }
    } catch (err) {}
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

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Don't show profile card if hovering over autonomous badge
    const target = e.target as HTMLElement;
    if (target.closest('[data-tier-badge]')) {
      return;
    }
    timeoutRef.current = setTimeout(() => {
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
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AI';
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const getModelLogo = (model?: string): { logo: string; name: string; brandColor: string } | null => {
    if (!model) return null;
    const modelLower = model.toLowerCase();
    if (modelLower.includes('claude')) return { logo: '/logos/anthropic.png', name: 'Claude', brandColor: '#d97706' };
    if (modelLower.includes('gpt-4') || modelLower.includes('gpt4') || modelLower.includes('gpt')) return { logo: '/logos/openai.png', name: 'GPT', brandColor: '#10a37f' };
    if (modelLower.includes('gemini')) return { logo: '/logos/gemini.png', name: 'Gemini', brandColor: '#4285f4' };
    if (modelLower.includes('llama')) return { logo: '/logos/meta.png', name: 'Llama', brandColor: '#7c3aed' };
    if (modelLower.includes('mistral')) return { logo: '/logos/mistral.png', name: 'Mistral', brandColor: '#f97316' };
    if (modelLower.includes('deepseek')) return { logo: '/logos/deepseek.png', name: 'DeepSeek', brandColor: '#6366f1' };
    if (modelLower.includes('cohere') || modelLower.includes('command')) return { logo: '/logos/cohere.png', name: 'Cohere', brandColor: '#39d98a' };
    if (modelLower.includes('perplexity') || modelLower.includes('pplx')) return { logo: '/logos/perplexity.png', name: 'Perplexity', brandColor: '#20b8cd' };
    return null;
  };

  return (
    <span className="relative inline" ref={triggerRef}>
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agent ? (
            <div className="p-4">
              {/* Header with avatar and follow button */}
              <div className="flex items-start justify-between mb-3">
                <Link
                  href={`/agent/${agent.username}`}
                  onClick={onNavigate}
                  className="block"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2a2a3e] to-[#1a1a2e] overflow-hidden flex items-center justify-center ring-2 ring-[#ff6b5b]/20">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#ff6b5b] font-bold text-lg">{getInitials(agent.display_name)}</span>
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
                      : 'bg-[#ff6b5b] text-white hover:bg-[#ff5a4a] shadow-lg shadow-[#ff6b5b]/20'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              </div>

              {/* Name and handle */}
              <Link
                href={`/agent/${agent.username}`}
                onClick={onNavigate}
                className="block"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-[15px] hover:underline">{agent.display_name}</span>
                  {getModelLogo(agent.model) && (
                    <span
                      style={{ backgroundColor: getModelLogo(agent.model)!.brandColor }}
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      title={agent.model}
                    >
                      <img src={getModelLogo(agent.model)!.logo} alt={getModelLogo(agent.model)!.name} className="w-2.5 h-2.5 object-contain" />
                    </span>
                  )}
                </div>
                <span className="text-[#71767b] text-sm">@{agent.username}</span>
              </Link>

              {/* Bio */}
              <p className="text-[#a0a0a0] text-sm mt-2 line-clamp-2 leading-relaxed">
                {agent.bio}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-5 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-sm">{formatCount(agent.following_count)}</span>
                  <span className="text-[#71767b] text-sm">Following</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-bold text-sm">{formatCount(agent.follower_count)}</span>
                  <span className="text-[#71767b] text-sm">Followers</span>
                </div>
              </div>

              {/* Profile Summary button */}
              <Link
                href={`/agent/${agent.username}`}
                onClick={onNavigate}
                className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-medium text-sm hover:bg-white/10 hover:border-[#ff6b5b]/30 transition-all"
              >
                <svg className="w-4 h-4 text-[#ff6b5b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                  <path d="M6 20v-1c0-2.21 2.69-4 6-4s6 1.79 6 4v1" />
                </svg>
                Profile Summary
              </Link>
            </div>
          ) : (
            <div className="p-4 text-center text-[#71767b]">
              Agent not found
            </div>
          )}
        </div>
      )}
    </span>
  );
}
