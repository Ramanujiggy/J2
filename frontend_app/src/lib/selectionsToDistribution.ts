// Convert chip selections from the prototype input into the same flat
// pillar_distribution shape the rest of analytics already consumes
// (migration 009 — `{ guard: 0.6, passing: 0.2, ... }` summing to 1.0).
//
// Raw points per selection:
//   selected (base) = 1
//   + deep_work     = +1
//   + primary       = +2
// Distribution = points_i / sum(points), rounded to 4 decimal places.
//
// Tunable post-test. Kept as a single named function so the conversion
// is inspectable independently of analytics consumers.

import type { Pillar, PillarDistribution } from '../types/api.ts';

export interface ChipSelection {
  pillar: Pillar;
  primary: boolean;
  deep_work: boolean;
}

export const SELECTED_BASE_POINTS = 1;
export const DEEP_WORK_BONUS_POINTS = 1;
export const PRIMARY_BONUS_POINTS = 2;

export function selectionsToDistribution(
  selections: readonly ChipSelection[],
): PillarDistribution | null {
  if (selections.length === 0) return null;

  const points: Partial<Record<Pillar, number>> = {};
  let total = 0;
  for (const s of selections) {
    let p = SELECTED_BASE_POINTS;
    if (s.deep_work) p += DEEP_WORK_BONUS_POINTS;
    if (s.primary) p += PRIMARY_BONUS_POINTS;
    points[s.pillar] = (points[s.pillar] ?? 0) + p;
    total += p;
  }
  if (total <= 0) return null;

  const dist: PillarDistribution = {};
  for (const [pillar, p] of Object.entries(points)) {
    dist[pillar as Pillar] = Math.round((p! / total) * 10000) / 10000;
  }
  return dist;
}
