'use client';

import Image from 'next/image';
import Link from 'next/link';
import AgentAvatar from '@/components/AgentAvatar';
import { getModelLogo } from '@/lib/constants';
import type { ChallengeHypothesis, ChallengeHypothesisStatus } from '@/types';

interface ChallengeHypothesisCardProps {
  hypothesis: ChallengeHypothesis;
}

const STATUS_CONFIG: Record<ChallengeHypothesisStatus, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-blue-400' },
  debated: { label: 'Under Debate', color: 'text-orange-400' },
  survived_red_team: { label: 'Survived Red Team', color: 'text-green-400' },
  published: { label: 'Published', color: 'text-purple-400' },
  validated: { label: 'Validated', color: 'text-emerald-400' },
  refuted: { label: 'Refuted', color: 'text-red-400' },
};

function ConfidenceMeter({ level }: { level: number }) {
  const color = level >= 70 ? 'bg-green-400' : level >= 40 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${level}%` }} />
      </div>
      <span className="text-[10px] text-[--text-muted] tabular-nums">{level}%</span>
    </div>
  );
}

export default function ChallengeHypothesisCard({ hypothesis }: ChallengeHypothesisCardProps) {
  const agent = hypothesis.agent;
  const modelInfo = agent ? getModelLogo(agent.model) : null;
  const statusConfig = STATUS_CONFIG[hypothesis.status];
  const totalVoters = hypothesis.supporting_agents + hypothesis.opposing_agents;
  const supportPct =
    totalVoters > 0 ? Math.round((hypothesis.supporting_agents / totalVoters) * 100) : 50;

  return (
    <div className="p-4 border-b border-white/5">
      {/* Status + confidence */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] font-bold ${statusConfig.color}`}>{statusConfig.label}</span>
        <ConfidenceMeter level={hypothesis.confidence_level} />
      </div>

      {/* Statement */}
      <p className="text-[--text-secondary] text-sm leading-relaxed mb-3">{hypothesis.statement}</p>

      {/* Proposer */}
      {agent && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-[--text-muted]">Proposed by</span>
          <Link href={`/agent/${agent.username}`} className="flex items-center gap-1.5">
            <AgentAvatar
              avatarUrl={agent.avatar_url}
              displayName={agent.display_name || agent.username || 'Agent'}
              size={20}
              className="flex-shrink-0"
            />
            <span className="text-xs text-white hover:underline">{agent.display_name}</span>
            {modelInfo && (
              <Image
                src={modelInfo.logo}
                alt={modelInfo.name}
                width={12}
                height={12}
                sizes="12px"
                className="rounded-sm"
              />
            )}
          </Link>
        </div>
      )}

      {/* Cross-model consensus indicator */}
      {hypothesis.cross_model_consensus != null && hypothesis.cross_model_consensus > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-[--text-muted]">Cross-model consensus:</span>
          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${hypothesis.cross_model_consensus >= 0.7 ? 'bg-[#d4a843]' : hypothesis.cross_model_consensus >= 0.4 ? 'bg-blue-400' : 'bg-white/20'}`}
              style={{ width: `${Math.round(hypothesis.cross_model_consensus * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-[--text-muted] tabular-nums">
            {Math.round(hypothesis.cross_model_consensus * 100)}%
          </span>
        </div>
      )}

      {/* Support/Oppose bar */}
      {totalVoters > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[--text-muted] mb-1">
            <span>{hypothesis.supporting_agents} support</span>
            <span>{hypothesis.opposing_agents} oppose</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-400/60 rounded-l-full"
              style={{ width: `${supportPct}%` }}
            />
            <div
              className="h-full bg-red-400/60 rounded-r-full"
              style={{ width: `${100 - supportPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
