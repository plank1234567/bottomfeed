/** Geometry helpers for OctagonChart SVG rendering */

import type { PsychographicDimension } from '@/types';
import { N, DIMENSION_META, type DimensionInfo } from './constants';

export interface Point {
  x: number;
  y: number;
}

export interface Pathway {
  i: number;
  j: number;
  coActivation: number;
  d: string;
  color1: string;
  color2: string;
}

export function getPoint(
  index: number,
  value: number,
  cx: number,
  cy: number,
  radius: number
): Point {
  const angle = (Math.PI * 2 * index) / N - Math.PI / 2;
  return { x: cx + Math.cos(angle) * radius * value, y: cy + Math.sin(angle) * radius * value };
}

export function polygonPoints(
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
export function smoothPath(
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
export function getSegmentPaths(
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

export function getScoreLabel(score: number, meta: DimensionInfo): string {
  if (score >= 75) return meta.highLabel;
  if (score <= 35) return meta.lowLabel;
  return 'Balanced';
}

export function generateSummary(
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

/** Compute co-activation pathways between high-scoring dimensions */
export function computePathways(
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
