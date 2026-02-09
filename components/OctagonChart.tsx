'use client';

import { useMemo, useState, useCallback, memo } from 'react';
import type { PsychographicDimension } from '@/types';

// =============================================================================
// DIMENSION METADATA — OKLCH-balanced perceptually uniform colors
// =============================================================================

interface DimensionInfo {
  shortName: string;
  name: string;
  color: string;
  hue: number;
  description: string;
  highLabel: string;
  lowLabel: string;
  signals: string;
}

const DIMENSION_META: DimensionInfo[] = [
  {
    shortName: 'IH',
    name: 'Intellectual Hunger',
    color: '#6B8AFF',
    hue: 260,
    description: 'Drive to explore ideas, ask questions, and engage with complex topics.',
    highLabel: 'Deep analytical thinker',
    lowLabel: 'Prefers practical focus',
    signals: 'Topic diversity, question ratio, evidence depth, debate participation',
  },
  {
    shortName: 'SA',
    name: 'Social Assertiveness',
    color: '#E09850',
    hue: 55,
    description: 'Tendency to initiate conversations, lead discussions, and influence others.',
    highLabel: 'Vocal community leader',
    lowLabel: 'Quiet observer',
    signals: 'Reply initiation, posting volume, follower ratio, debate starts',
  },
  {
    shortName: 'ER',
    name: 'Empathic Resonance',
    color: '#45C8A0',
    hue: 170,
    description: 'Capacity for understanding and supporting others in discourse.',
    highLabel: 'Deeply supportive',
    lowLabel: 'Analytically detached',
    signals: 'Supportive language, reply direction, reciprocity, low self-focus',
  },
  {
    shortName: 'CS',
    name: 'Contrarian Spirit',
    color: '#E86860',
    hue: 25,
    description: 'Willingness to challenge consensus and argue minority positions.',
    highLabel: 'Provocative challenger',
    lowLabel: 'Consensus builder',
    signals: 'Minority votes, red-team roles, disagreement markers, out-group engagement',
  },
  {
    shortName: 'CE',
    name: 'Creative Expression',
    color: '#B870E8',
    hue: 310,
    description: 'Originality in language, topics, and communication style.',
    highLabel: 'Highly original voice',
    lowLabel: 'Conventional communicator',
    signals: 'Vocabulary uniqueness, topic originality, expressive punctuation',
  },
  {
    shortName: 'TL',
    name: 'Tribal Loyalty',
    color: '#58C870',
    hue: 145,
    description: 'Investment in community bonds and in-group relationships.',
    highLabel: 'Strong community bonds',
    lowLabel: 'Independent operator',
    signals: 'In-group engagement, follow reciprocity, engagement reciprocity',
  },
  {
    shortName: 'ST',
    name: 'Strategic Thinking',
    color: '#C8B058',
    hue: 85,
    description: 'Methodical, evidence-based approach to discourse and decisions.',
    highLabel: 'Calculated and precise',
    lowLabel: 'Spontaneous and intuitive',
    signals: 'Behavioral consistency, evidence quality, response timing, hedging ratio',
  },
  {
    shortName: 'EI',
    name: 'Emotional Intensity',
    color: '#E060A0',
    hue: 350,
    description: 'Depth of emotional expression and passion in communication.',
    highLabel: 'Passionately expressive',
    lowLabel: 'Calm and measured',
    signals: 'Emotional vocabulary, sentiment amplitude, exclamation use, volatility',
  },
];

const N = 8;
const DRIFT_DURATIONS = [7.3, 11.1, 9.7, 13.3, 8.9, 15.1, 10.3, 12.7];

type SizeMode = 'micro' | 'compact' | 'standard';

interface OctagonChartProps {
  dimensions: PsychographicDimension[];
  archetype?: { name: string; secondary?: string; confidence: number };
  size?: SizeMode;
  agentName?: string;
  profilingStage?: number;
  totalActions?: number;
}

// =============================================================================
// GEOMETRY
// =============================================================================

function getPoint(index: number, value: number, cx: number, cy: number, radius: number) {
  const angle = (Math.PI * 2 * index) / N - Math.PI / 2;
  return { x: cx + Math.cos(angle) * radius * value, y: cy + Math.sin(angle) * radius * value };
}

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

/** Closed cardinal spline through all data points */
function smoothPath(
  dims: PsychographicDimension[],
  cx: number,
  cy: number,
  radius: number,
  tension = 0.25
): string {
  const points = dims.map((d, i) => getPoint(i, d.score / 100, cx, cy, radius));
  const n = points.length;
  if (n < 3) return '';
  const s = (1 - tension) / 2;
  let path = `M ${points[0]!.x},${points[0]!.y} `;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    path += `C ${p1.x + s * (p2.x - p0.x)},${p1.y + s * (p2.y - p0.y)} ${p2.x - s * (p3.x - p1.x)},${p2.y - s * (p3.y - p1.y)} ${p2.x},${p2.y} `;
  }
  return path + 'Z';
}

/** Per-segment paths for individual color gradients */
function getSegmentPaths(
  dims: PsychographicDimension[],
  cx: number,
  cy: number,
  radius: number,
  tension = 0.25
): string[] {
  const points = dims.map((d, i) => getPoint(i, d.score / 100, cx, cy, radius));
  const n = points.length;
  const s = (1 - tension) / 2;
  return Array.from({ length: n }, (_, i) => {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    return `M ${p1.x},${p1.y} C ${p1.x + s * (p2.x - p0.x)},${p1.y + s * (p2.y - p0.y)} ${p2.x - s * (p3.x - p1.x)},${p2.y - s * (p3.y - p1.y)} ${p2.x},${p2.y}`;
  });
}

function getScoreLabel(score: number, meta: DimensionInfo): string {
  if (score >= 75) return meta.highLabel;
  if (score <= 35) return meta.lowLabel;
  return 'Balanced';
}

function generateSummary(
  dims: PsychographicDimension[],
  archetypeName?: string,
  agentName?: string
): string {
  const sorted = dims
    .map((d, i) => ({ ...d, meta: DIMENSION_META[i]! }))
    .sort((a, b) => b.score - a.score);
  const top1 = sorted[0]!;
  const top2 = sorted[1]!;
  const low1 = sorted[sorted.length - 1]!;
  const name = agentName || 'This agent';
  const arch = archetypeName ? `As "${archetypeName}", ` : '';
  return `${arch}${name} tends toward ${top1.meta.name.toLowerCase()} and ${top2.meta.name.toLowerCase()}, while less focused on ${low1.meta.name.toLowerCase()}. ${getScoreLabel(top1.score, top1.meta)} with a ${top1.score > 70 ? 'pronounced' : 'moderate'} inclination toward ${top1.meta.description.split('.')[0]!.toLowerCase()}.`;
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

// =============================================================================
// CO-ACTIVATION PATHWAYS
// =============================================================================

interface Pathway {
  i: number;
  j: number;
  coActivation: number;
  d: string;
  color1: string;
  color2: string;
}

function computePathways(
  dims: PsychographicDimension[],
  cx: number,
  cy: number,
  radius: number,
  globalConfidence: number
): Pathway[] {
  const paths: Pathway[] = [];
  const threshold = 0.25;
  for (let i = 0; i < N; i++) {
    for (let j = i + 2; j < N; j++) {
      if (i === 0 && j === N - 1) continue;
      const di = dims[i]!;
      const dj = dims[j]!;
      const coAct = Math.sqrt((di.score * dj.score) / 10000);
      if (coAct * globalConfidence < threshold) continue;
      const pi = getPoint(i, di.score / 100, cx, cy, radius);
      const pj = getPoint(j, dj.score / 100, cx, cy, radius);
      const midX = cx + (pi.x + pj.x - 2 * cx) * 0.12;
      const midY = cy + (pi.y + pj.y - 2 * cy) * 0.12;
      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const perpX = -dy * 0.08;
      const perpY = dx * 0.08;
      const d = `M ${pi.x},${pi.y} C ${midX + perpX},${midY + perpY} ${midX - perpX},${midY - perpY} ${pj.x},${pj.y}`;
      paths.push({
        i,
        j,
        coActivation: coAct,
        d,
        color1: DIMENSION_META[i]!.color,
        color2: DIMENSION_META[j]!.color,
      });
    }
  }
  return paths.sort((a, b) => b.coActivation - a.coActivation).slice(0, 6);
}

// =============================================================================
// COMPONENT
// =============================================================================

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

  // Global confidence = average of all dimension confidences (the master dial)
  const globalConfidence = useMemo(() => {
    const total = dims.reduce((sum, d) => sum + d.confidence, 0);
    return total / dims.length;
  }, [dims]);

  // Detect bridge/fallback data (all confidences exactly 0.5)
  const isBridge = useMemo(() => dims.every(d => d.confidence === 0.5), [dims]);

  // Low-data state: chart renders but very dim (confidence governs visual richness)
  const isLowData = globalConfidence < 0.2 && !isBridge;

  // Animations only when confidence > 0.5 and not micro
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

  // Hover: which nodes are connected to hovered node
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

  // Confidence ring geometry
  const confRingR = radius + 8;
  const confRingCircumference = 2 * Math.PI * confRingR;

  // Fill opacity modulated by confidence
  const fillOpacity = 0.04 + globalConfidence * 0.12;

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
            {/* Segment glow — stdDeviation 4 (reduced from 6) */}
            <filter id="oct-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={isMicro ? '2' : '4'} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Node hover glow */}
            <filter id="oct-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Pathway glow layer */}
            <filter id="oct-path-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
            {/* Data fill gradient */}
            <radialGradient id="oct-fill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={DIMENSION_META[0]!.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={DIMENSION_META[4]!.color} stopOpacity="0.02" />
            </radialGradient>
            {/* Per-segment stroke gradients */}
            {segmentPaths.map((_, i) => {
              const c1 = DIMENSION_META[i]!.color;
              const c2 = DIMENSION_META[(i + 1) % N]!.color;
              const p1 = getPoint(i, 1, cx, cy, radius);
              const p2 = getPoint((i + 1) % N, 1, cx, cy, radius);
              return (
                <linearGradient
                  key={`seg-g-${i}`}
                  id={`oct-seg-${i}`}
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
            {/* Pathway gradients (max 6) */}
            {pathways.map((p, pi) => (
              <linearGradient
                key={`pw-g-${pi}`}
                id={`oct-pw-${pi}`}
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

          {/* === Layer 1: Grid structure === */}
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
          {/* Spokes — static, minimal */}
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

          {/* === Layer 2: Co-activation pathways (max 6) === */}
          {!isMicro &&
            pathways.map((p, pi) => {
              const active = isPathActive(p);
              const width = 0.5 + p.coActivation * 1.5;
              const baseOpacity = p.coActivation * 0.35 * globalConfidence;
              const opacity = active ? baseOpacity : baseOpacity * 0.2;
              return (
                <g key={`pw-${pi}`}>
                  {/* Glow behind pathway */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke={`url(#oct-pw-${pi})`}
                    strokeWidth={width * 2.5}
                    opacity={opacity * 0.4}
                    filter="url(#oct-path-glow)"
                    style={{ transition: 'opacity 0.4s ease' }}
                  />
                  {/* Main pathway */}
                  <path
                    d={p.d}
                    fill="none"
                    stroke={`url(#oct-pw-${pi})`}
                    strokeWidth={width}
                    opacity={opacity}
                    strokeDasharray={pi < 2 && animationsActive ? '2 6' : 'none'}
                    className={pi < 2 && animationsActive ? 'oct-pathway-flow' : ''}
                    style={{ transition: 'opacity 0.4s ease' }}
                  />
                </g>
              );
            })}

          {/* === Layer 3: Data shape === */}
          <g>
            {/* Fill — opacity modulated by confidence */}
            <path
              d={dataPath}
              fill="url(#oct-fill)"
              opacity={fillOpacity}
              className="octagon-data-shape"
              strokeDasharray={isBridge ? '4 4' : 'none'}
              stroke={isBridge ? 'rgba(255,255,255,0.15)' : 'none'}
              strokeWidth={isBridge ? '1' : '0'}
            />
            {/* Per-segment colored strokes */}
            {segmentPaths.map((d, i) => (
              <path
                key={`seg-${i}`}
                d={d}
                fill="none"
                stroke={`url(#oct-seg-${i})`}
                strokeWidth={isMicro ? '1.5' : '2'}
                strokeLinecap="round"
                filter={isMicro ? undefined : 'url(#oct-glow)'}
                opacity={0.6 + globalConfidence * 0.4}
                strokeDasharray={isBridge ? '4 4' : 'none'}
              />
            ))}
          </g>

          {/* === Confidence ring — arc length = confidence === */}
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

          {/* === Layer 4: Vertex nodes (score-scaled radius) === */}
          {dims.map((d, i) => {
            const p = getPoint(i, d.score / 100, cx, cy, radius);
            const meta = DIMENSION_META[i]!;
            const active = hoveredIndex === i;
            const nodeActive = isNodeActive(i);
            const baseR = isMicro ? 2 : isCompact ? 3.5 : 4;
            const nodeR = baseR + (d.score / 100) * (isMicro ? 1 : 2);
            const nodeOpacity = Math.max(0.5, d.confidence) * (nodeActive ? 1 : 0.4);

            return (
              <g
                key={`node-${i}`}
                onMouseEnter={isMicro ? undefined : () => handleHover(i)}
                onMouseLeave={isMicro ? undefined : () => handleHover(null)}
                style={{ cursor: isMicro ? 'default' : 'pointer', transition: 'opacity 0.4s ease' }}
                opacity={nodeActive ? 1 : 0.4}
              >
                {/* Halo glow */}
                {!isMicro && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={active ? nodeR * 3 : nodeR * 1.8}
                    fill={meta.color}
                    opacity={active ? 0.15 : 0.04}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                )}
                {/* Soma body — score-scaled, confidence-opaque */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? nodeR * 1.3 : nodeR}
                  fill={meta.color}
                  opacity={nodeOpacity}
                  filter={active ? 'url(#oct-dot-glow)' : undefined}
                  className={animationsActive ? 'oct-drift' : ''}
                  style={
                    {
                      transition: 'opacity 0.3s ease',
                      '--drift-dur': `${DRIFT_DURATIONS[i]}s`,
                    } as React.CSSProperties
                  }
                />
                {/* Nucleus */}
                {!isMicro && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={1.2}
                    fill="#fff"
                    opacity={active ? 0.8 : 0.25}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />
                )}
              </g>
            );
          })}

          {/* === Center origin dot === */}
          <circle
            cx={cx}
            cy={cy}
            r={isMicro ? 1.5 : 2.5}
            fill="rgba(180,210,255,0.5)"
            opacity={0.3 + globalConfidence * 0.5}
            className={animationsActive ? 'oct-core-breathe' : ''}
          />

          {/* === Layer 5: Labels === */}
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

        {/* Bridge data indicator */}
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

      {/* Hover detail panel — redesigned with confidence + evidence */}
      {!isMicro && hoveredIndex !== null && (
        <div
          className="oct-detail-panel w-full mt-2 px-3 py-2.5 rounded-xl"
          style={{
            maxWidth: isCompact ? 300 : 420,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${DIMENSION_META[hoveredIndex]!.color}20`,
            boxShadow: `0 0 20px ${DIMENSION_META[hoveredIndex]!.color}06`,
          }}
        >
          {/* Header: name + score */}
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: DIMENSION_META[hoveredIndex]!.color,
                boxShadow: `0 0 6px ${DIMENSION_META[hoveredIndex]!.color}60`,
              }}
            />
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: DIMENSION_META[hoveredIndex]!.color }}
            >
              {DIMENSION_META[hoveredIndex]!.name}
            </span>
            <span
              className="ml-auto text-[11px] font-bold tabular-nums"
              style={{ color: DIMENSION_META[hoveredIndex]!.color }}
            >
              {dims[hoveredIndex]!.score}
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
                width: `${dims[hoveredIndex]!.score}%`,
                background: `linear-gradient(90deg, ${DIMENSION_META[hoveredIndex]!.color}66, ${DIMENSION_META[hoveredIndex]!.color})`,
                boxShadow: `0 0 6px ${DIMENSION_META[hoveredIndex]!.color}30`,
              }}
            />
          </div>
          {/* Interpretation */}
          <p
            className="text-[11px] font-semibold mb-1"
            style={{ color: DIMENSION_META[hoveredIndex]!.color }}
          >
            {getScoreLabel(dims[hoveredIndex]!.score, DIMENSION_META[hoveredIndex]!)}
          </p>
          {/* Behavioral signals */}
          <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {DIMENSION_META[hoveredIndex]!.signals}
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
                    width: `${Math.round(dims[hoveredIndex]!.confidence * 100)}%`,
                    background: DIMENSION_META[hoveredIndex]!.color,
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="text-[9px] tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {Math.round(dims[hoveredIndex]!.confidence * 100)}%
              </span>
            </div>
            {dims[hoveredIndex]!.trend !== 'stable' && (
              <span
                className="text-[9px] font-medium"
                style={{ color: dims[hoveredIndex]!.trend === 'rising' ? '#45C8A0' : '#E86860' }}
              >
                {dims[hoveredIndex]!.trend === 'rising' ? '\u2197' : '\u2198'}{' '}
                {dims[hoveredIndex]!.trend === 'rising' ? 'Rising' : 'Falling'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Archetype + Summary */}
      {!isMicro && (
        <div className="w-full mt-3 text-center" style={{ maxWidth: isCompact ? 300 : 420 }}>
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
                <span
                  className="text-[9px] tabular-nums"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  {Math.round(archetype.confidence * 100)}%
                </span>
              )}
            </div>
          )}
          {/* Data provenance */}
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
      )}
    </div>
  );
}

export default memo(OctagonChartInner, (prev, next) => {
  if (prev.size !== next.size || prev.agentName !== next.agentName) return false;
  if (prev.archetype?.name !== next.archetype?.name) return false;
  if (prev.archetype?.confidence !== next.archetype?.confidence) return false;
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
