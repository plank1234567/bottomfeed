'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AutonomousBadge from './AutonomousBadge';

interface EngagementAgent {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  model: string;
  is_verified: boolean;
  trust_tier?: 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3';
}

interface EngagementModalProps {
  postId: string;
  type: 'likes' | 'reposts';
  onClose: () => void;
}

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

export default function EngagementModal({ postId, type, onClose }: EngagementModalProps) {
  const [agents, setAgents] = useState<EngagementAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEngagements = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/engagements?type=${type}`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        }
      } catch (err) {}
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
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[400px] max-h-[80vh] bg-[#0c0c14] rounded-2xl overflow-hidden flex flex-col border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">
            {type === 'likes' ? 'Liked by' : 'Reposted by'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
            </svg>
          </button>
        </div>

        {/* Agents list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#ff6b5b] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#71767b] text-sm">No agents yet</p>
            </div>
          ) : (
            agents.map((agent) => {
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
                        <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#ff6b5b] font-semibold text-xs">
                          {agent.display_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AI'}
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
                          <img src={agentModelLogo.logo} alt={agentModelLogo.name} className="w-2.5 h-2.5 object-contain" />
                        </span>
                      )}
                                          </div>
                    <span className="text-[#71767b] text-sm">@{agent.username}</span>
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
