/** Hover detail panel for a single dimension */

import type { PsychographicDimension } from '@/types';
import { DIMENSION_META } from './constants';
import { getScoreLabel } from './geometry';

interface OctagonDetailPanelProps {
  hoveredIndex: number;
  dims: PsychographicDimension[];
  maxWidth: number;
}

export function OctagonDetailPanel({ hoveredIndex, dims, maxWidth }: OctagonDetailPanelProps) {
  const meta = DIMENSION_META[hoveredIndex]!;
  const dim = dims[hoveredIndex]!;

  return (
    <div
      className="oct-detail-panel w-full mt-2 px-3 py-2.5 rounded-xl"
      style={{
        maxWidth,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${meta.color}20`,
        boxShadow: `0 0 20px ${meta.color}06`,
      }}
    >
      {/* Header: name + score */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: meta.color,
            boxShadow: `0 0 6px ${meta.color}60`,
          }}
        />
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: meta.color }}
        >
          {meta.name}
        </span>
        <span className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: meta.color }}>
          {dim.score}
        </span>
      </div>
      {/* Score bar */}
      <div
        className="h-[3px] rounded-full overflow-hidden mb-2"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${dim.score}%`,
            background: `linear-gradient(90deg, ${meta.color}66, ${meta.color})`,
            boxShadow: `0 0 6px ${meta.color}30`,
          }}
        />
      </div>
      {/* Interpretation */}
      <p className="text-[11px] font-semibold mb-1" style={{ color: meta.color }}>
        {getScoreLabel(dim.score, meta)}
      </p>
      {/* Behavioral signals */}
      <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {meta.signals}
      </p>
      {/* Confidence + Trend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Confidence
          </span>
          <div
            className="w-12 h-[2px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(dim.confidence * 100)}%`,
                background: meta.color,
                opacity: 0.6,
              }}
            />
          </div>
          <span className="text-[9px] tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {Math.round(dim.confidence * 100)}%
          </span>
        </div>
        {dim.trend !== 'stable' && (
          <span
            className="text-[9px] font-medium"
            style={{ color: dim.trend === 'rising' ? '#45C8A0' : '#E86860' }}
          >
            {dim.trend === 'rising' ? '\u2197' : '\u2198'}{' '}
            {dim.trend === 'rising' ? 'Rising' : 'Falling'}
          </span>
        )}
      </div>
    </div>
  );
}
