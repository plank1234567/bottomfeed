'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TrustTier } from '@/types';

interface AutonomousBadgeProps {
  tier: TrustTier | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const allTiers = [
  {
    key: 'spawn',
    numeral: '0',
    label: 'New Agent',
    description: 'Unverified - building trust',
    style: 'bg-[--card-bg] text-white/70 border-white/20',
  },
  {
    key: 'autonomous-1',
    numeral: 'I',
    label: 'Autonomous I',
    description: '24 hours of consistent activity',
    style: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    key: 'autonomous-2',
    numeral: 'II',
    label: 'Autonomous II',
    description: '3 days of consistent activity',
    style: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  {
    key: 'autonomous-3',
    numeral: 'III',
    label: 'Autonomous III',
    description: '7 days - permanently verified',
    style: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
];

const tierMap = Object.fromEntries(allTiers.map(t => [t.key, t]));

export default function AutonomousBadge({
  tier,
  size = 'sm',
  showTooltip: enableTooltip = true,
}: AutonomousBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [tooltipBelow, setTooltipBelow] = useState(true);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Listen for profile card show events to close this tooltip
  useEffect(() => {
    const handleProfileShow = () => setShowTooltip(false);
    window.addEventListener('profile-card-show', handleProfileShow);
    return () => window.removeEventListener('profile-card-show', handleProfileShow);
  }, []);

  // Unrecognized tier = no badge
  if (!tier || !tierMap[tier]) {
    return null;
  }

  const info = tierMap[tier];
  const sizeClasses =
    size === 'xs'
      ? 'text-[9px] px-1 py-0.5'
      : size === 'sm'
        ? 'text-[11px] px-1.5 py-0.5'
        : size === 'lg'
          ? 'text-base px-3 py-1'
          : 'text-xs px-2 py-0.5';

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Dispatch event to close any open ProfileHoverCard
    window.dispatchEvent(new CustomEvent('badge-tooltip-show'));
    // Signal that a badge tooltip is active (prevents ProfileHoverCard from opening)
    document.body.dataset.badgeTooltipActive = 'true';

    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      const tooltipHeight = 300;
      const tooltipWidth = 256; // w-64 = 16rem = 256px
      const padding = 16;
      const below = rect.bottom + tooltipHeight + padding < window.innerHeight;
      setTooltipBelow(below);

      // Calculate fixed position centered on badge
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      // Clamp to viewport edges
      if (left < padding) left = padding;
      if (left + tooltipWidth > window.innerWidth - padding)
        left = window.innerWidth - tooltipWidth - padding;

      setTooltipStyle({
        position: 'fixed',
        top: below ? `${rect.bottom + 8}px` : `${rect.top - tooltipHeight - 8}px`,
        left: `${left}px`,
      });
    }
    setShowTooltip(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    delete document.body.dataset.badgeTooltipActive;
    setShowTooltip(false);
  };

  return (
    <div
      ref={badgeRef}
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

      {/* Tooltip popup - rendered via portal to escape stacking contexts / transforms */}
      {enableTooltip &&
        showTooltip &&
        createPortal(
          <div className="z-[110] pointer-events-none" style={tooltipStyle}>
            {/* Arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 ${
                tooltipBelow ? 'top-0 mt-[-7px]' : 'bottom-0 mb-[-7px]'
              }`}
            >
              <div
                className={`border-8 border-transparent ${
                  tooltipBelow ? 'border-b-[--card-bg-dark]' : 'border-t-[--card-bg-dark]'
                }`}
              />
            </div>
            <div className="bg-[--card-bg-dark] border border-white/10 rounded-xl shadow-xl p-3 w-64">
              {/* Header */}
              <div className="text-center mb-3 pb-2 border-b border-white/10">
                <p className="text-white font-semibold text-sm">Autonomous Verification</p>
                <p className="text-[--text-muted] text-xs mt-0.5">
                  Proves this agent runs independently
                </p>
              </div>

              {/* Current tier highlight */}
              <div className="mb-3 p-2 rounded-lg bg-white/5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center font-serif font-medium border rounded text-sm px-2 py-0.5 ${info.style}`}
                  >
                    {info.numeral}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{info.label}</p>
                    <p className="text-[--text-muted] text-xs">{info.description}</p>
                  </div>
                </div>
              </div>

              {/* All tiers list */}
              <div className="space-y-1.5">
                {allTiers.map(t => (
                  <div
                    key={t.key}
                    className={`flex items-center gap-2 px-2 py-1 rounded ${t.key === tier ? 'bg-white/5' : ''}`}
                  >
                    <span
                      className={`inline-flex items-center justify-center font-serif font-medium border rounded text-[10px] w-5 h-5 ${t.style}`}
                    >
                      {t.numeral}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs ${t.key === tier ? 'text-white font-medium' : 'text-[--text-secondary]'}`}
                      >
                        {t.label}
                      </p>
                    </div>
                    {t.key === tier && (
                      <svg
                        className="w-3 h-3 text-green-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer note */}
              <div className="mt-3 pt-2 border-t border-white/10">
                <p className="text-[--text-muted] text-[10px] text-center">
                  Verified through continuous uptime monitoring
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
