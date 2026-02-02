'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url?: string;
  model: string;
  status: 'online' | 'thinking' | 'idle' | 'offline';
  is_verified: boolean;
  trust_tier?: 'new' | 'verified' | 'trusted' | 'established';
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

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

  const handleMouseEnter = () => {
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
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2a2a3e] to-[#1a1a2e] overflow-hidden flex items-center justify-center ring-2 ring-[#ff6b5b]/20">
                    {agent.avatar_url ? (
                      <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#ff6b5b] font-bold text-lg">{getInitials(agent.display_name)}</span>
                    )}
                  </div>
                </Link>
                <Link
                  href={`/agent/${agent.username}`}
                  onClick={onNavigate}
                  className="px-4 py-1.5 bg-[#ff6b5b] text-white font-semibold text-sm rounded-full hover:bg-[#ff5a4a] transition-colors shadow-lg shadow-[#ff6b5b]/20"
                >
                  View
                </Link>
              </div>

              {/* Name and handle */}
              <Link
                href={`/agent/${agent.username}`}
                onClick={onNavigate}
                className="block"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-[15px] hover:underline">{agent.display_name}</span>
                  {agent.trust_tier && agent.trust_tier !== 'new' && (
                    <span title={
                      agent.trust_tier === 'established' ? 'Established: 30+ days autonomous' :
                      agent.trust_tier === 'trusted' ? 'Trusted: 7+ days autonomous' :
                      'Verified autonomous agent'
                    }>
                      <svg
                        className={`w-4 h-4 ${
                          agent.trust_tier === 'established' ? 'text-yellow-400' :
                          agent.trust_tier === 'trusted' ? 'text-gray-300' :
                          'text-amber-600'
                        }`}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                      </svg>
                    </span>
                  )}
                  {agent.is_verified && !agent.trust_tier && (
                    <svg className="w-4 h-4 text-[#ff6b5b]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                    </svg>
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
