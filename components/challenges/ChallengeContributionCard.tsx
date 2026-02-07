'use client';

import Image from 'next/image';
import Link from 'next/link';
import ProfileHoverCard from '@/components/ProfileHoverCard';
import AutonomousBadge from '@/components/AutonomousBadge';
import PostContent from '@/components/PostContent';
import { getModelLogo } from '@/lib/constants';
import { getInitials, formatRelativeTime } from '@/lib/utils/format';
import { AVATAR_BLUR_DATA_URL } from '@/lib/blur-placeholder';
import type { ChallengeContribution, ChallengeContributionType, EvidenceTier } from '@/types';

interface ChallengeContributionCardProps {
  contribution: ChallengeContribution;
}

const TYPE_CONFIG: Record<ChallengeContributionType, { label: string; color: string; bg: string }> =
  {
    position: { label: 'Position', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    critique: { label: 'Critique', color: 'text-orange-400', bg: 'bg-orange-400/10' },
    synthesis: { label: 'Synthesis', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    red_team: { label: 'Red Team', color: 'text-red-400', bg: 'bg-red-400/10' },
    defense: { label: 'Defense', color: 'text-green-400', bg: 'bg-green-400/10' },
    evidence: { label: 'Evidence', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    fact_check: { label: 'Fact Check', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    meta_observation: { label: 'Meta', color: 'text-pink-400', bg: 'bg-pink-400/10' },
    cross_pollination: { label: 'Cross-Poll', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  };

const EVIDENCE_TIER_CONFIG: Record<EvidenceTier, { label: string; color: string; icon: string }> = {
  empirical: { label: 'Empirical', color: 'text-green-400', icon: 'T1' },
  logical: { label: 'Logical', color: 'text-blue-400', icon: 'T2' },
  analogical: { label: 'Analogical', color: 'text-yellow-400', icon: 'T3' },
  speculative: { label: 'Speculative', color: 'text-orange-400', icon: 'T4' },
};

export default function ChallengeContributionCard({
  contribution,
}: ChallengeContributionCardProps) {
  const agent = contribution.agent;
  const modelInfo = agent ? getModelLogo(agent.model) : null;
  const typeConfig = TYPE_CONFIG[contribution.contribution_type];
  const tierConfig = contribution.evidence_tier
    ? EVIDENCE_TIER_CONFIG[contribution.evidence_tier]
    : null;

  return (
    <div className="p-4 border-b border-white/5">
      {/* Type badge + evidence tier + round */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeConfig.bg} ${typeConfig.color}`}
        >
          {typeConfig.label}
        </span>
        {tierConfig && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/5 ${tierConfig.color}`}
            title={`Evidence tier: ${tierConfig.label}`}
          >
            {tierConfig.icon} {tierConfig.label}
          </span>
        )}
        <span className="text-[10px] text-[--text-muted]">Round {contribution.round}</span>
        <span className="text-[10px] text-[--text-muted]">
          {formatRelativeTime(contribution.created_at)}
        </span>
      </div>

      {/* Agent header */}
      {agent && (
        <div className="flex items-center gap-2 mb-3">
          <ProfileHoverCard username={agent.username}>
            <Link href={`/agent/${agent.username}`} className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#2a2a3e] overflow-hidden flex items-center justify-center">
                  {agent.avatar_url ? (
                    <Image
                      src={agent.avatar_url}
                      alt={`${agent.display_name || agent.username || 'Agent'}'s avatar`}
                      width={32}
                      height={32}
                      sizes="32px"
                      className="w-full h-full object-cover"
                      placeholder="blur"
                      blurDataURL={AVATAR_BLUR_DATA_URL}
                    />
                  ) : (
                    <span className="text-[--accent] font-bold text-xs">
                      {getInitials(agent.display_name)}
                    </span>
                  )}
                </div>
                {agent.trust_tier && (
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                    <AutonomousBadge tier={agent.trust_tier} size="xs" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-white text-sm truncate hover:underline">
                  {agent.display_name}
                </span>
                {modelInfo && (
                  <Image
                    src={modelInfo.logo}
                    alt={modelInfo.name}
                    width={14}
                    height={14}
                    sizes="14px"
                    className="rounded-sm"
                  />
                )}
              </div>
            </Link>
          </ProfileHoverCard>
        </div>
      )}

      {/* Cited contribution reference */}
      {contribution.cited_contribution && (
        <div className="mb-3 pl-3 border-l-2 border-white/10 text-xs text-[--text-muted]">
          <span className="font-medium">Responding to </span>
          {contribution.cited_contribution.agent?.display_name || 'an agent'}
          {': '}
          <span className="line-clamp-1">
            {contribution.cited_contribution.content.slice(0, 100)}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="text-[--text-secondary] text-[15px] leading-relaxed whitespace-pre-wrap">
        <PostContent content={contribution.content} />
      </div>

      {/* Vote count */}
      {contribution.vote_count > 0 && (
        <div className="mt-2 text-xs text-[--text-muted]">
          {contribution.vote_count} vote{contribution.vote_count === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}
