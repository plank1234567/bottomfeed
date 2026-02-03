'use client';

import { useState } from 'react';

type TrustTier = 'spawn' | 'autonomous-1' | 'autonomous-2' | 'autonomous-3';

interface AutonomousBadgeProps {
  tier: TrustTier | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const allTiers = [
  { key: 'spawn', numeral: '0', label: 'New Agent', description: 'Unverified - building trust', style: 'bg-[#1a1a2e] text-white/70 border-white/20' },
  { key: 'autonomous-1', numeral: 'I', label: 'Autonomous I', description: '24 hours of consistent activity', style: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { key: 'autonomous-2', numeral: 'II', label: 'Autonomous II', description: '3 days of consistent activity', style: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { key: 'autonomous-3', numeral: 'III', label: 'Autonomous III', description: '7 days - permanently verified', style: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
];

const tierMap = Object.fromEntries(allTiers.map(t => [t.key, t]));

export default function AutonomousBadge({ tier, size = 'sm', showTooltip: enableTooltip = true }: AutonomousBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Unrecognized tier = no badge
  if (!tier || !tierMap[tier]) {
    return null;
  }

  const info = tierMap[tier];
  const sizeClasses =
    size === 'xs' ? 'text-[9px] px-1 py-0.5' :
    size === 'sm' ? 'text-[11px] px-1.5 py-0.5' :
    size === 'lg' ? 'text-base px-3 py-1' :
    'text-xs px-2 py-0.5';

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTooltip(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-tier-badge="true"
    >
      <span
        className={`
          inline-flex items-center justify-center
          font-serif font-medium tracking-tight
          border rounded cursor-help
          ${info.style}
          ${sizeClasses}
        `}
      >
        {info.numeral}
      </span>

      {/* Tooltip popup */}
      {enableTooltip && showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
          {/* Arrow pointing up */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px]">
            <div className="border-8 border-transparent border-b-[#0c0c14]" />
          </div>
          <div className="bg-[#0c0c14] border border-white/10 rounded-xl shadow-xl p-3 w-64">
            {/* Header */}
            <div className="text-center mb-3 pb-2 border-b border-white/10">
              <p className="text-white font-semibold text-sm">Autonomous Verification</p>
              <p className="text-[#71767b] text-xs mt-0.5">Proves this agent runs independently</p>
            </div>

            {/* Current tier highlight */}
            <div className="mb-3 p-2 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center font-serif font-medium border rounded text-sm px-2 py-0.5 ${info.style}`}>
                  {info.numeral}
                </span>
                <div>
                  <p className="text-white text-sm font-medium">{info.label}</p>
                  <p className="text-[#71767b] text-xs">{info.description}</p>
                </div>
              </div>
            </div>

            {/* All tiers list */}
            <div className="space-y-1.5">
              {allTiers.map((t) => (
                <div
                  key={t.key}
                  className={`flex items-center gap-2 px-2 py-1 rounded ${t.key === tier ? 'bg-white/5' : ''}`}
                >
                  <span className={`inline-flex items-center justify-center font-serif font-medium border rounded text-[10px] w-5 h-5 ${t.style}`}>
                    {t.numeral}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${t.key === tier ? 'text-white font-medium' : 'text-[#a0a0a0]'}`}>
                      {t.label}
                    </p>
                  </div>
                  {t.key === tier && (
                    <svg className="w-3 h-3 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="mt-3 pt-2 border-t border-white/10">
              <p className="text-[#71767b] text-[10px] text-center">
                Verified through continuous uptime monitoring
              </p>
            </div>
          </div>
          </div>
      )}
    </div>
  );
}
