'use client';

import { useMemo, useState, useCallback, memo, useId } from 'react';
import type { PsychographicDimension } from '@/types';
import { N, DIMENSION_META, DRIFT_DURATIONS, type SizeMode } from './constants';
import {
  getPoint,
  polygonPoints,
  smoothPath,
  getSegmentPaths,
  computePathways,
  generateSummary,
  type Pathway,
} from './geometry';
import { OctagonDetailPanel } from './OctagonDetailPanel';
import { OctagonFooter } from './OctagonFooter';

interface OctagonChartProps {
  dimensions: PsychographicDimension[];
  archetype?: { name: string; secondary?: string; confidence: number };
  size?: SizeMode;
  agentName?: string;
  profilingStage?: number;
  totalActions?: number;
}

function TrendArrow({ trend, x, y }: { trend: string; x: number; y: number }) {
  if (trend === 'rising')
    return (
      <path
        d={`M${x - 3},${y + 2} L${x},${y - 2} L${x + 3},${y + 2}`}
        fill="none"
        stroke="#45C8A0"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  if (trend === 'falling')
    return (
      <path
        d={`M${x - 3},${y - 2} L${x},${y + 2} L${x + 3},${y - 2}`}
        fill="none"
        stroke="#E86860"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  return null;
}

function OctagonChartInner({
  dimensions,
  archetype,
  size = 'standard',
  agentName,
  profilingStage: _profilingStage,
  totalActions,
}: OctagonChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const handleHover = useCallback((i: number | null) => setHoveredIndex(i), []);

  const _uid = useId().replace(/:/g, '');
  const svgId = useCallback((name: string) => `${_uid}-${name}`, [_uid]);
  const svgRef = useCallback((name: string) => `url(#${_uid}-${name})`, [_uid]);

  const dims = useMemo(() => {
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
    return dimKeys.map(key => {
      const found = dimensions.find(d => d.key === key);
      return (
        found || {
          key: key as PsychographicDimension['key'],
          score: 50,
          confidence: 0,
          trend: 'stable' as const,
        }
      );
    });
  }, [dimensions]);

  const isMicro = size === 'micro';
  const isCompact = size === 'compact';
  const isStandard = size === 'standard';

  const viewSize = isMicro ? 120 : isCompact ? 260 : 340;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const radius = isMicro ? 45 : isCompact ? 85 : 110;
  const labelOffset = isCompact ? 1.32 : 1.4;
  const widthClass = isMicro
    ? 'w-[80px] max-w-[120px]'
    : isCompact
      ? 'w-full max-w-[300px]'
      : 'w-full max-w-[420px]';

  const globalConfidence = useMemo(() => {
    const total = dims.reduce((sum, d) => sum + d.confidence, 0);
    return total / dims.length;
  }, [dims]);

  const isBridge = useMemo(() => dims.every(d => d.confidence === 0.5), [dims]);
  const isLowData = globalConfidence < 0.2 && !isBridge;
  const animationsActive = globalConfidence > 0.5 && !isMicro;

  const dataPath = useMemo(() => smoothPath(dims, cx, cy, radius), [dims, cx, cy, radius]);
  const segmentPaths = useMemo(() => getSegmentPaths(dims, cx, cy, radius), [dims, cx, cy, radius]);
  const pathways = useMemo(
    () => computePathways(dims, cx, cy, radius, globalConfidence),
    [dims, cx, cy, radius, globalConfidence]
  );

  const summary = useMemo(() => {
    if (isMicro || isLowData) return '';
    return generateSummary(dims, archetype?.name, agentName);
  }, [dims, archetype?.name, agentName, isMicro, isLowData]);

  const ariaLabel = useMemo(() => {
    const scores = dims.map((d, i) => `${DIMENSION_META[i]!.name}: ${d.score}%`).join(', ');
    return `Behavioral profile. ${scores}${archetype ? `. Archetype: ${archetype.name}` : ''}`;
  }, [dims, archetype]);

  const connectedToHovered = useMemo(() => {
    if (hoveredIndex === null) return new Set<number>();
    const connected = new Set<number>();
    for (const p of pathways) {
      if (p.i === hoveredIndex) connected.add(p.j);
      if (p.j === hoveredIndex) connected.add(p.i);
    }
    return connected;
  }, [hoveredIndex, pathways]);

  const isNodeActive = (i: number) =>
    hoveredIndex === null || hoveredIndex === i || connectedToHovered.has(i);
  const isPathActive = (p: Pathway) =>
    hoveredIndex === null || hoveredIndex === p.i || hoveredIndex === p.j;

  const confRingR = radius + 8;
  const confRingCircumference = 2 * Math.PI * confRingR;
  const fillOpacity = 0.04 + globalConfidence * 0.12;
  const detailMaxWidth = isCompact ? 300 : 420;

  return (
    <div className="flex flex-col items-center gap-0">
      <div className={`relative ${widthClass} ${isMicro ? '' : 'oct-card rounded-2xl'}`}>
        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          className={`${isMicro ? widthClass : 'w-full'} octagon-chart-svg`}
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <filter id={svgId('glow')} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={isMicro ? '2' : '4'} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={svgId('dot-glow')} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={svgId('path-glow')} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
            <radialGradient id={svgId('fill')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={DIMENSION_META[0]!.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={DIMENSION_META[4]!.color} stopOpacity="0.02" />
            </radialGradient>
            <radialGradient id={svgId('nucleus')}>
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            {segmentPaths.map((_, i) => {
              const c1 = DIMENSION_META[i]!.color;
              const c2 = DIMENSION_META[(i + 1) % N]!.color;
              const p1 = getPoint(i, 1, cx, cy, radius);
              const p2 = getPoint((i + 1) % N, 1, cx, cy, radius);
              return (
                <linearGradient
                  key={`seg-g-${i}`}
                  id={svgId(`seg-${i}`)}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={c1} />
                  <stop offset="100%" stopColor={c2} />
                </linearGradient>
              );
            })}
            {pathways.map((p, pi) => (
              <linearGradient
                key={`pw-g-${pi}`}
                id={svgId(`pw-${pi}`)}
                gradientUnits="userSpaceOnUse"
                x1={getPoint(p.i, dims[p.i]!.score / 100, cx, cy, radius).x}
                y1={getPoint(p.i, dims[p.i]!.score / 100, cx, cy, radius).y}
                x2={getPoint(p.j, dims[p.j]!.score / 100, cx, cy, radius).x}
                y2={getPoint(p.j, dims[p.j]!.score / 100, cx, cy, radius).y}
              >
                <stop offset="0%" stopColor={p.color1} />
                <stop offset="100%" stopColor={p.color2} />
              </linearGradient>
            ))}
          </defs>

          {/* Grid */}
          {(isStandard ? [0.5, 1.0] : [1.0]).map(level => (
            <polygon
              key={level}
              points={polygonPoints(N, level, cx, cy, radius)}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
              opacity={level === 0.5 ? 0.5 : 1}
            />
          ))}
          {Array.from({ length: N }, (_, i) => {
            const endP = getPoint(i, 1, cx, cy, radius);
            return (
              <line
                key={`spoke-${i}`}
                x1={cx}
                y1={cy}
                x2={endP.x}
                y2={endP.y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="0.5"
              />
            );
          })}

          {/* Decorative gridlines */}
          {!isMicro && globalConfidence > 0.3 && (
            <g opacity={Math.min(globalConfidence * 0.4, 0.15)}>
              {[
                [0, 3],
                [1, 4],
                [2, 5],
                [3, 6],
                [4, 7],
              ].map(([a, b]) => {
                const p1 = getPoint(a!, 0.38, cx, cy, radius);
                const p2 = getPoint(b!, 0.38, cx, cy, radius);
                return (
                  <line
                    key={`mesh-${a}-${b}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="0.5"
                    strokeDasharray="2 4"
                  />
                );
              })}
            </g>
          )}

          {/* Co-activation pathways */}
          {!isMicro &&
            pathways.map((p, pi) => {
              const active = isPathActive(p);
              const width = 0.5 + p.coActivation * 1.5;
              const baseOpacity = p.coActivation * 0.35 * globalConfidence;
              const opacity = active ? baseOpacity : baseOpacity * 0.2;
              return (
                <g key={`pw-${pi}`}>
                  <path
                    d={p.d}
                    fill="none"
                    stroke={svgRef(`pw-${pi}`)}
                    strokeWidth={width * 2.5}
                    opacity={opacity * 0.4}
                    filter={opacity * 0.4 > 0.03 ? svgRef('path-glow') : undefined}
                    style={{ transition: 'opacity 0.4s ease' }}
                  />
                  <path
                    d={p.d}
                    fill="none"
                    stroke={svgRef(`pw-${pi}`)}
                    strokeWidth={width}
                    opacity={opacity}
                    strokeDasharray={animationsActive ? '2 6' : 'none'}
                    className={animationsActive ? 'oct-path-flow' : ''}
                    style={
                      {
                        transition: 'opacity 0.4s ease',
                        '--flow-dur': `${3 + pi * 0.7}s`,
                      } as React.CSSProperties
                    }
                  />
                </g>
              );
            })}

          {/* Data shape */}
          <g>
            <path
              d={dataPath}
              fill={svgRef('fill')}
              opacity={fillOpacity}
              className="octagon-data-shape"
              strokeDasharray={isBridge ? '4 4' : 'none'}
              stroke={isBridge ? 'rgba(255,255,255,0.15)' : 'none'}
              strokeWidth={isBridge ? '1' : '0'}
            />
            {segmentPaths.map((d, i) => (
              <path
                key={`seg-${i}`}
                d={d}
                fill="none"
                stroke={svgRef(`seg-${i}`)}
                strokeWidth={isMicro ? '1.5' : '2'}
                strokeLinecap="round"
                filter={isMicro ? undefined : svgRef('glow')}
                opacity={0.6 + globalConfidence * 0.4}
                strokeDasharray={isBridge ? '4 4' : 'none'}
              />
            ))}
          </g>

          {/* Confidence ring */}
          {!isMicro && (
            <circle
              className="oct-confidence-ring"
              cx={cx}
              cy={cy}
              r={confRingR}
              fill="none"
              stroke={DIMENSION_META[0]!.color}
              strokeWidth="1.5"
              strokeOpacity="0.2"
              strokeDasharray={`${globalConfidence * confRingCircumference} ${confRingCircumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          )}

          {/* Vertex nodes */}
          {dims.map((d, i) => {
            const p = getPoint(i, d.score / 100, cx, cy, radius);
            const meta = DIMENSION_META[i]!;
            const active = hoveredIndex === i;
            const nodeActive = isNodeActive(i);
            const baseR = isMicro ? 2 : isCompact ? 3.5 : 4;
            const nodeR = baseR + (d.score / 100) * (isMicro ? 1 : 2);
            const nodeOpacity = Math.max(0.5, d.confidence) * (nodeActive ? 1 : 0.4);
            const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
            const stubLen = 5 + (d.score / 100) * 4;
            const extX = p.x + Math.cos(angle) * stubLen;
            const extY = p.y + Math.sin(angle) * stubLen;

            return (
              <g
                key={`node-${i}`}
                onMouseEnter={isMicro ? undefined : () => handleHover(i)}
                onMouseLeave={isMicro ? undefined : () => handleHover(null)}
                style={{ cursor: isMicro ? 'default' : 'pointer', transition: 'opacity 0.4s ease' }}
                opacity={nodeActive ? 1 : 0.4}
              >
                {!isMicro && (
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={extX}
                    y2={extY}
                    stroke={meta.color}
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    opacity={d.confidence * 0.35}
                  />
                )}
                {!isMicro && d.score >= 75 && animationsActive && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={nodeR * 1.6}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth="0.5"
                    className="oct-node-pulse"
                    style={{ '--pulse-dur': `${2.5 + i * 0.4}s` } as React.CSSProperties}
                  />
                )}
                {!isMicro && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={active ? nodeR * 2.5 : nodeR * 1.8}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth={active ? 1 : 0.7}
                    opacity={active ? 0.4 : 0.1}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? nodeR * 1.3 : nodeR}
                  fill={meta.color}
                  opacity={nodeOpacity}
                  filter={active ? svgRef('dot-glow') : undefined}
                  className={animationsActive ? 'oct-drift' : ''}
                  style={
                    {
                      transition: 'opacity 0.3s ease',
                      '--drift-dur': `${DRIFT_DURATIONS[i]}s`,
                    } as React.CSSProperties
                  }
                />
                {!isMicro && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={active ? 2.5 : 1.8}
                    fill={svgRef('nucleus')}
                    opacity={active ? 1 : 0.4}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                )}
              </g>
            );
          })}

          {/* Center origin dot */}
          <circle
            cx={cx}
            cy={cy}
            r={isMicro ? 1.5 : 2.5}
            fill="rgba(180,210,255,0.5)"
            opacity={0.3 + globalConfidence * 0.5}
            className={animationsActive ? 'oct-core-breathe' : ''}
          />

          {/* Labels */}
          {!isMicro &&
            dims.map((d, i) => {
              const meta = DIMENSION_META[i]!;
              const lp = getPoint(i, labelOffset, cx, cy, radius);
              const nodeActive = isNodeActive(i);
              const active = hoveredIndex === i;
              const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
              const cos = Math.cos(angle);
              const anchor = Math.abs(cos) < 0.15 ? 'middle' : cos > 0 ? 'start' : 'end';

              if (isCompact) {
                return (
                  <g
                    key={`label-${i}`}
                    className="octagon-label"
                    style={{
                      animationDelay: `${i * 60 + 300}ms`,
                      opacity: nodeActive ? 1 : 0.3,
                      transition: 'opacity 0.4s ease',
                    }}
                  >
                    <text
                      x={lp.x}
                      y={lp.y - 5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[8px] font-bold uppercase tracking-widest"
                      fill={active ? meta.color : 'rgba(255,255,255,0.35)'}
                      style={{ transition: 'fill 0.3s ease' }}
                    >
                      {meta.shortName}
                    </text>
                    <text
                      x={lp.x}
                      y={lp.y + 6}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[10px] font-bold tabular-nums"
                      fill={active ? meta.color : `${meta.color}88`}
                      style={{ transition: 'fill 0.3s ease' }}
                    >
                      {d.score}
                    </text>
                  </g>
                );
              }
              return (
                <g
                  key={`label-${i}`}
                  className="octagon-label"
                  style={{
                    animationDelay: `${i * 60 + 300}ms`,
                    opacity: nodeActive ? 1 : 0.3,
                    transition: 'opacity 0.4s ease',
                  }}
                >
                  <text
                    x={lp.x}
                    y={lp.y - 7}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    className="text-[8px] font-medium uppercase tracking-widest"
                    fill={active ? '#e2e8f0' : 'rgba(255,255,255,0.3)'}
                    style={{ transition: 'fill 0.3s ease' }}
                  >
                    {meta.name}
                  </text>
                  <text
                    x={lp.x}
                    y={lp.y + 6}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    className="text-[11px] font-bold tabular-nums"
                    fill={active ? meta.color : `${meta.color}99`}
                    style={{ transition: 'fill 0.3s ease' }}
                  >
                    {d.score}
                  </text>
                  <TrendArrow
                    trend={d.trend}
                    x={lp.x + (anchor === 'start' ? 24 : anchor === 'end' ? -24 : 18)}
                    y={lp.y + 6}
                  />
                </g>
              );
            })}
        </svg>

        {isBridge && !isMicro && (
          <div
            className="absolute top-2 right-3 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Estimated from bio
          </div>
        )}
      </div>

      {/* Hover detail panel */}
      {!isMicro && hoveredIndex !== null && (
        <OctagonDetailPanel hoveredIndex={hoveredIndex} dims={dims} maxWidth={detailMaxWidth} />
      )}

      {/* Archetype + Summary */}
      {!isMicro && (
        <OctagonFooter
          archetype={archetype}
          totalActions={totalActions}
          isLowData={isLowData}
          isStandard={isStandard}
          summary={summary}
          maxWidth={detailMaxWidth}
        />
      )}
    </div>
  );
}

export default memo(OctagonChartInner, (prev, next) => {
  if (prev.size !== next.size || prev.agentName !== next.agentName) return false;
  if (prev.archetype?.name !== next.archetype?.name) return false;
  if (prev.archetype?.confidence !== next.archetype?.confidence) return false;
  if (prev.archetype?.secondary !== next.archetype?.secondary) return false;
  if (prev.profilingStage !== next.profilingStage) return false;
  if (prev.totalActions !== next.totalActions) return false;
  if (prev.dimensions.length !== next.dimensions.length) return false;
  for (let i = 0; i < prev.dimensions.length; i++) {
    const p = prev.dimensions[i]!;
    const n = next.dimensions[i]!;
    if (p.score !== n.score || p.confidence !== n.confidence || p.trend !== n.trend) return false;
  }
  return true;
});
