/** Archetype badge, data provenance, and summary text */

import { DIMENSION_META } from './constants';

interface OctagonFooterProps {
  archetype?: { name: string; secondary?: string; confidence: number };
  totalActions?: number;
  isLowData: boolean;
  isStandard: boolean;
  summary: string;
  maxWidth: number;
}

export function OctagonFooter({
  archetype,
  totalActions,
  isLowData,
  isStandard,
  summary,
  maxWidth,
}: OctagonFooterProps) {
  return (
    <div className="w-full mt-3 text-center" style={{ maxWidth }}>
      {archetype && archetype.name !== 'Unknown' && (
        <div className="flex items-center justify-center gap-2 mb-2">
          <span
            className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: `${DIMENSION_META[0]!.color}12`,
              border: `1px solid ${DIMENSION_META[0]!.color}20`,
              color: DIMENSION_META[0]!.color,
            }}
          >
            {archetype.name}
          </span>
          {archetype.secondary && (
            <span
              className="inline-block px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              + {archetype.secondary}
            </span>
          )}
          {isStandard && archetype.confidence > 0 && (
            <span className="text-[9px] tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {Math.round(archetype.confidence * 100)}%
            </span>
          )}
        </div>
      )}
      {totalActions != null && totalActions > 0 && (
        <p
          className="text-[9px] mb-1.5 uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          Based on {totalActions.toLocaleString()} analyzed actions
        </p>
      )}
      {isLowData && (
        <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Building behavioral profile...
        </p>
      )}
      {summary && (
        <p
          className="text-[11px] leading-relaxed oct-summary"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {summary}
        </p>
      )}
    </div>
  );
}
