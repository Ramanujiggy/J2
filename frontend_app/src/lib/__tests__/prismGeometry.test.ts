import { describe, it, expect } from 'vitest';
import {
  PILLAR_ORDER,
  prismVertices,
  distributionPoints,
  peakWeight,
  dominantPillar,
} from '../prismGeometry.ts';
import type { PillarDistribution } from '../../types/api.ts';

/** Distance of each polygon point from the centre. */
function radii(points: string, cx: number, cy: number): number[] {
  return points.split(' ').map(pair => {
    const [x, y] = pair.split(',').map(Number) as [number, number];
    return Math.hypot(x - cx, y - cy);
  });
}

describe('prismVertices', () => {
  it('puts vertex 0 straight up and runs clockwise', () => {
    const v = prismVertices(0, 0, 100, 0);
    expect(v.map(p => p.value)).toEqual(PILLAR_ORDER.map(p => p.value));
    expect(v[0]!.cx).toBeCloseTo(0, 5);
    expect(v[0]!.cy).toBeCloseTo(-100, 5);
    // Clockwise in SVG coords: the next vertex moves right.
    expect(v[1]!.cx).toBeGreaterThan(0);
  });
});

describe('distributionPoints', () => {
  const heavy: PillarDistribution = { guard: 0.5, passing: 0.3, pins: 0.2 };
  const light: PillarDistribution = { guard: 0.1, passing: 0.06, pins: 0.04 };

  // Per-session normalisation pinned every session's top pillar to the rim,
  // so 60 stacked sessions rendered as one hard-edged star instead of an
  // accumulation you can see through.
  it('keeps sessions on a shared scale so smaller ones nest inside larger', () => {
    const scale = peakWeight([heavy, light]);
    const heavyMax = Math.max(...radii(distributionPoints(heavy, 0, 0, 100, scale), 0, 0));
    const lightMax = Math.max(...radii(distributionPoints(light, 0, 0, 100, scale), 0, 0));
    expect(heavyMax).toBeGreaterThan(lightMax * 2);
  });

  it('lets the busiest pillar in the set reach the rim', () => {
    const scale = peakWeight([heavy, light]);
    // Points are emitted at one decimal place, so compare at that precision.
    expect(Math.max(...radii(distributionPoints(heavy, 0, 0, 100, scale), 0, 0)))
      .toBeCloseTo(100, 1);
  });

  it('floors untouched pillars off the dead centre', () => {
    const r = radii(distributionPoints({ guard: 1 }, 0, 0, 100, 1), 0, 0);
    expect(Math.min(...r)).toBeGreaterThan(0);
  });

  it('does not divide by zero on an empty set', () => {
    expect(() => distributionPoints({}, 0, 0, 100, peakWeight([]))).not.toThrow();
  });
});

describe('peakWeight', () => {
  it('finds the heaviest single pillar across every distribution', () => {
    expect(peakWeight([{ guard: 0.4 }, { passing: 0.7, pins: 0.1 }])).toBeCloseTo(0.7);
    expect(peakWeight([])).toBe(0);
  });
});

describe('dominantPillar', () => {
  it('returns the heaviest pillar, or null when there is no weight', () => {
    expect(dominantPillar({ guard: 0.2, passing: 0.6 })).toBe('passing');
    expect(dominantPillar({})).toBeNull();
    expect(dominantPillar(null)).toBeNull();
  });
});
