// Prism pentagon geometry — the single source of truth for vertex placement.
//
// Vertex 0 sits at −90° (straight up) and the rest run clockwise:
// Stand-up · Passing · Pins · Subs · Guard. This ordering is fixed by the
// design handoff (margin-prism.reference.js) and must not be reordered —
// every prism render in the app, from the 26px study glyph to the 560px
// editorial instrument, reads the same shape from these functions.

import type { Pillar, PillarDistribution } from '../types/api.ts';

export const PILLAR_ORDER: ReadonlyArray<{ value: Pillar; label: string }> = [
  { value: 'standup',     label: 'Stand-up' },
  { value: 'passing',     label: 'Passing' },
  { value: 'pins',        label: 'Pins' },
  { value: 'submissions', label: 'Subs' },
  { value: 'guard',       label: 'Guard' },
];

/** Angle in radians for vertex `i` — −90° start, clockwise, 72° apart. */
export function vertexAngle(i: number): number {
  return ((-90 + i * 72) * Math.PI) / 180;
}

export interface PrismVertex {
  value: Pillar;
  label: string;
  /** Point on the outer pentagon. */
  cx: number;
  cy: number;
  /** Label anchor, pushed out past the vertex. */
  lx: number;
  ly: number;
}

/**
 * Vertex coordinates for a prism centred at (cx, cy) with radius r.
 * `labelGap` is how far past the vertex the label anchor sits.
 */
export function prismVertices(cx: number, cy: number, r: number, labelGap = 22): PrismVertex[] {
  return PILLAR_ORDER.map((p, i) => {
    const angle = vertexAngle(i);
    return {
      ...p,
      cx: cx + r * Math.cos(angle),
      cy: cy + r * Math.sin(angle),
      lx: cx + (r + labelGap) * Math.cos(angle),
      ly: cy + (r + labelGap) * Math.sin(angle),
    };
  });
}

/** SVG `points` string for a set of vertices. */
export function toPolygonPoints(pts: Array<{ cx: number; cy: number }>): string {
  return pts.map(v => `${v.cx.toFixed(1)},${v.cy.toFixed(1)}`).join(' ');
}

/**
 * The heaviest single pillar weight across a set of distributions — the
 * denominator for rendering them on one shared scale.
 */
export function peakWeight(dists: PillarDistribution[]): number {
  let peak = 0;
  for (const d of dists) {
    for (const p of PILLAR_ORDER) {
      const w = d[p.value] ?? 0;
      if (w > peak) peak = w;
    }
  }
  return peak;
}

/**
 * Polygon points for one session's pillar distribution — each vertex pulled in
 * toward the centre by its weight. `floor` keeps untouched pillars off the dead
 * centre so a single-pillar session still reads as a shape rather than a spike.
 *
 * `scale` is the denominator every session is measured against. Pass ONE value
 * for the whole set (see peakWeight) rather than normalising each session
 * against its own maximum: per-session normalisation pins every session's top
 * pillar to the outer rim, so stacking them produces one hard-edged star
 * instead of an accumulation you can see through.
 */
export function distributionPoints(
  dist: PillarDistribution,
  cx: number,
  cy: number,
  r: number,
  scale = 1,
  floor = 0.1,
): string {
  const denom = scale > 0 ? scale : 1;
  const pts = PILLAR_ORDER.map((p, i) => {
    const mag = Math.max(floor, Math.min(1, (dist[p.value] ?? 0) / denom));
    const angle = vertexAngle(i);
    return {
      cx: cx + r * mag * Math.cos(angle),
      cy: cy + r * mag * Math.sin(angle),
    };
  });
  return toPolygonPoints(pts);
}

/** The heaviest pillar in a distribution, or null when it carries no weight. */
export function dominantPillar(dist: PillarDistribution | null | undefined): Pillar | null {
  if (!dist) return null;
  let best: Pillar | null = null;
  let bestWeight = 0;
  for (const p of PILLAR_ORDER) {
    const w = dist[p.value] ?? 0;
    if (w > bestWeight) { bestWeight = w; best = p.value; }
  }
  return best;
}

/** Display label for a pillar ("submissions" → "Subs"). */
export function pillarLabel(pillar: Pillar): string {
  return PILLAR_ORDER.find(p => p.value === pillar)?.label ?? pillar;
}
