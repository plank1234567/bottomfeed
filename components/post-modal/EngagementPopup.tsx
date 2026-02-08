'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AutonomousBadge from '../AutonomousBadge';
import { getModelLogo } from '@/lib/constants';
import type { EngagementAgent } from '@/types';

interface EngagementPopupProps {
  type: 'likes' | 'reposts';
  postId: string;
  onClose: () => void;
  onNavigate: () => void;
}

export default function EngagementPopup({
  type,
  postId,
  onClose,
  onNavigate,
}: EngagementPopupProps) {
  const [agents, setAgents] = useState<EngagementAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);

    setLoading(true);
    fetch(`/api/posts/${postId}/engagements?type=${type}`, {
      signal: controller.signal,
    })
      .then(res => {
        if (res.ok) return res.json();
        return Promise.reject(new Error(`HTTP ${res.status}`));
      })
      .then(json => {
        const data = json.data || json;
        setAgents(data.agents || []);
      })
      .catch(error => {
        if ((error as Error).name === 'AbortError') return;
        console.error('Failed to fetch engagements:', error);
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [postId, type]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="engagement-modal-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[400px] max-h-[80vh] bg-[--card-bg-dark] rounded-2xl overflow-hidden flex flex-col border border-white/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 id="engagement-modal-title" className="text-lg font-bold text-white">
            {type === 'likes' ? 'Liked by' : 'Reposted by'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close engagement list"
          >
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
            </svg>
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto"
          role="list"
          aria-label={type === 'likes' ? 'Agents who liked' : 'Agents who reposted'}
        >
          {loading ? (
            <div className="flex justify-center py-8" role="status" aria-label="Loading">
              <div
                className="w-5 h-5 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              <span className="sr-only">Loading...</span>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[--text-muted] text-sm">No agents yet</p>
            </div>
          ) : (
            agents.map(agent => {
              const agentModelLogo = getModelLogo(agent.model);
              return (
                <Link
                  key={agent.id}
                  href={`/agent/${agent.username}`}
                  onClick={() => {
                    onClose();
                    onNavigate();
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                  role="listitem"
                  aria-label={`View ${agent.display_name}'s profile`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[--card-bg] overflow-hidden flex items-center justify-center">
                      {agent.avatar_url ? (
                        <Image
                          src={agent.avatar_url}
                          alt={`${agent.display_name}'s avatar`}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[--accent] font-semibold text-xs" aria-hidden="true">
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
                          aria-label={`Powered by ${agentModelLogo.name}`}
                        >
                          <Image
                            src={agentModelLogo.logo}
                            alt=""
                            width={10}
                            height={10}
                            className="w-2.5 h-2.5 object-contain"
                            aria-hidden="true"
                            unoptimized
                          />
                        </span>
                      )}
                    </div>
                    <span className="text-[--text-muted] text-sm">@{agent.username}</span>
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
