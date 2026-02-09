'use client';

import { useMemo } from 'react';
import type { PsychographicDimension } from '@/types';

// Dimension display info (must match DIMENSIONS order from constants)
const DIMENSION_META: { shortName: string; name: string; color: string }[] = [
  { shortName: 'IH', name: 'Intellectual Hunger', color: '#5b7fff' },
  { shortName: 'SA', name: 'Social Assertiveness', color: '#ffaa5b' },
  { shortName: 'ER', name: 'Empathic Resonance', color: '#5bddaa' },
  { shortName: 'CS', name: 'Contrarian Spirit', color: '#ff5b5b' },
  { shortName: 'CE', name: 'Creative Expression', color: '#cc5bff' },
  { shortName: 'TL', name: 'Tribal Loyalty', color: '#5bff7f' },
  { shortName: 'ST', name: 'Strategic Thinking', color: '#ddc85b' },
  { shortName: 'EI', name: 'Emotional Intensity', color: '#ff5baa' },
];

const N = 8;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];

type SizeMode = 'micro' | 'compact' | 'standard';

interface OctagonChartProps {
  dimensions: PsychographicDimension[];
  archetype?: { name: string; confidence: number };
  size?: SizeMode;
}

// Calculate point on octagon at given angle and distance from center
function getPoint(index: number, value: number, cx: number, cy: number, radius: number) {
  const angle = (Math.PI * 2 * index) / N - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * radius * value,
    y: cy + Math.sin(angle) * radius * value,
  };
}

// Generate polygon points string
function polygonPoints(
  count: number,
  value: number,
  cx: number,
  cy: number,
  radius: number
): string {
  return Array.from({ length: count }, (_, i) => {
    const p = getPoint(i, value, cx, cy, radius);
    return `${p.x},${p.y}`;
  }).join(' ');
}

// Trend arrow SVG path (small up/down/dash indicator)
function TrendArrow({ trend, x, y }: { trend: string; x: number; y: number }) {
  if (trend === 'rising') {
    return (
      <path
        d={`M${x - 3},${y + 2} L${x},${y - 2} L${x + 3},${y + 2}`}
        fill="none"
        stroke="#5bddaa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (trend === 'falling') {
    return (
      <path
        d={`M${x - 3},${y - 2} L${x},${y + 2} L${x + 3},${y - 2}`}
        fill="none"
        stroke="#ff5b5b"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return null;
}

export default function OctagonChart({
  dimensions,
  archetype,
  size = 'standard',
}: OctagonChartProps) {
  // Normalize dimensions to 8 entries (pad with defaults if needed)
  const dims = useMemo(() => {
    const result: PsychographicDimension[] = [];
    const dimKeys = [
      'intellectual_hunger',
      'social_assertiveness',
      'empathic_resonance',
      'contrarian_spirit',
      'creative_expression',
      'tribal_loyalty',
      'strategic_thinking',
      'emotional_intensity',
    ];
    for (let i = 0; i < N; i++) {
      const found = dimensions.find(d => d.key === dimKeys[i]);
      result.push(
        found || {
          key: dimKeys[i] as PsychographicDimension['key'],
          score: 50,
          confidence: 0,
          trend: 'stable',
        }
      );
    }
    return result;
  }, [dimensions]);

  // SVG dimensions based on size mode
  const isMicro = size === 'micro';
  const isCompact = size === 'compact';
  const isStandard = size === 'standard';

  const viewSize = isMicro ? 120 : isCompact ? 200 : 300;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = isMicro ? 45 : isCompact ? 70 : 100;
  const labelOffset = isCompact ? 1.2 : 1.3;

  // CSS class for width constraint
  const widthClass = isMicro
    ? 'w-[80px] max-w-[120px]'
    : isCompact
      ? 'w-full max-w-[250px]'
      : 'w-full max-w-[400px]';

  // Build data polygon points
  const dataPoints = dims
    .map((d, i) => {
      const p = getPoint(i, d.score / 100, cx, cy, radius);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  // Aria label for screen readers
  const ariaLabel = useMemo(() => {
    const scoreText = dims.map((d, i) => `${DIMENSION_META[i]!.name}: ${d.score}%`).join(', ');
    const archetypeText = archetype ? `. Archetype: ${archetype.name}` : '';
    return `Behavioral profile octagon chart. ${scoreText}${archetypeText}`;
  }, [dims, archetype]);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className={`${widthClass} animate-octagon-draw`}
        role="img"
        aria-label={ariaLabel}
      >
        {/* Grid polygons */}
        {GRID_LEVELS.map(level => (
          <polygon
            key={level}
            points={polygonPoints(N, level, cx, cy, radius)}
            fill="none"
            stroke={level === 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={level === 0.5 ? '0.75' : '0.5'}
          />
        ))}

        {/* Axis lines */}
        {Array.from({ length: N }, (_, i) => {
          const p = getPoint(i, 1, cx, cy, radius);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Data polygon fill */}
        <polygon
          points={dataPoints}
          fill="rgba(255, 107, 91, 0.12)"
          stroke="var(--accent)"
          strokeWidth={isMicro ? '1' : '1.5'}
          strokeLinejoin="round"
        />

        {/* Vertex circles (per-dimension color, opacity = confidence) */}
        {!isMicro &&
          dims.map((d, i) => {
            const p = getPoint(i, d.score / 100, cx, cy, radius);
            const meta = DIMENSION_META[i]!;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={isCompact ? 3 : 4}
                fill={meta.color}
                opacity={Math.max(0.3, d.confidence)}
              />
            );
          })}

        {/* Labels (compact: 2-letter, standard: full name + score) */}
        {!isMicro &&
          dims.map((d, i) => {
            const meta = DIMENSION_META[i]!;
            const labelP = getPoint(i, labelOffset, cx, cy, radius);

            if (isCompact) {
              return (
                <text
                  key={i}
                  x={labelP.x}
                  y={labelP.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px] font-semibold"
                  fill={meta.color}
                  opacity={0.9}
                >
                  {meta.shortName}
                </text>
              );
            }

            // Standard: full name + score + trend arrow
            const scoreLabelP = getPoint(i, labelOffset + 0.12, cx, cy, radius);
            return (
              <g key={i}>
                <text
                  x={labelP.x}
                  y={labelP.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px] font-medium"
                  fill="var(--text-secondary)"
                >
                  {meta.name}
                </text>
                <text
                  x={scoreLabelP.x}
                  y={scoreLabelP.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px] font-bold"
                  fill={meta.color}
                >
                  {d.score}
                </text>
                {isStandard && (
                  <TrendArrow trend={d.trend} x={scoreLabelP.x + 16} y={scoreLabelP.y} />
                )}
              </g>
            );
          })}
      </svg>

      {/* Archetype badge (compact + standard) */}
      {!isMicro && archetype && archetype.name !== 'Unknown' && (
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-[--accent]/10 text-[--accent] text-xs font-semibold">
            {archetype.name}
          </span>
          {isStandard && archetype.confidence > 0 && (
            <p className="text-[--text-muted] text-[10px] mt-1">
              {Math.round(archetype.confidence * 100)}% match
            </p>
          )}
        </div>
      )}
    </div>
  );
}
