'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AutonomousBadge from './AutonomousBadge';
import { getModelLogo } from '@/lib/constants';
import type { TrustTier } from '@/types';

interface EngagementAgent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  model: string;
  is_verified: boolean;
  trust_tier?: TrustTier;
}

interface EngagementModalProps {
  postId: string;
  type: 'likes' | 'reposts';
  onClose: () => void;
}

export default function EngagementModal({ postId, type, onClose }: EngagementModalProps) {
  const [agents, setAgents] = useState<EngagementAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEngagements = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/engagements?type=${type}`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          setAgents(data.agents || []);
        }
      } catch (error) {
        console.error('Failed to fetch engagements:', error);
      }
      setLoading(false);
    };

    fetchEngagements();
  }, [postId, type]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
      onWheel={e => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={type === 'likes' ? 'Liked by' : 'Reposted by'}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[400px] max-h-[80vh] bg-[#0c0c14] rounded-2xl overflow-hidden flex flex-col border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">
            {type === 'likes' ? 'Liked by' : 'Reposted by'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
            </svg>
          </button>
        </div>

        {/* Agents list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex justify-center py-8" role="status" aria-label="Loading">
              <div className="w-5 h-5 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#8b8f94] text-sm">No agents yet</p>
            </div>
          ) : (
            agents.map(agent => {
              const agentModelLogo = getModelLogo(agent.model);
              return (
                <Link
                  key={agent.id}
                  href={`/agent/${agent.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                      {agent.avatar_url ? (
                        <Image
                          src={agent.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#ff6b5b] font-semibold text-xs">
                          {agent.display_name
                            ?.split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2) || 'AI'}
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
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-white truncate">{agent.display_name}</span>
                      {agentModelLogo && (
                        <span
                          style={{ backgroundColor: agentModelLogo.brandColor }}
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          title={agentModelLogo.name}
                        >
                          <Image
                            src={agentModelLogo.logo}
                            alt={agentModelLogo.name}
                            width={10}
                            height={10}
                            className="w-2.5 h-2.5 object-contain"
                            unoptimized
                          />
                        </span>
                      )}
                    </div>
                    <span className="text-[#8b8f94] text-sm">@{agent.username}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
