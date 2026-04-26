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

const VALID_PILLARS = new Set<Pillar>(['standup', 'passing', 'pins', 'submissions', 'guard']);

/**
 * Reconstruct chip selections from an existing session record so the modal
 * pre-fills with what the user originally entered. `deep_work` is always
 * `false` here — that flag is not derivable from historical data.
 *
 * Priority: pillar_distribution (most precise) → tags → heading.
 */
export function sessionToSelections(session: {
  heading?: string | null;
  tags?: string[];
  pillar_distribution?: PillarDistribution | null;
}): ChipSelection[] {
  const dist = session.pillar_distribution;
  if (dist) {
    const entries = (Object.entries(dist) as [Pillar, number | undefined][])
      .filter(([k, v]) => VALID_PILLARS.has(k) && typeof v === 'number' && v > 0) as [Pillar, number][];
    if (entries.length > 0) {
      // Prefer the recorded heading as primary if it's in the distribution;
      // otherwise pick the top-weighted pillar.
      const headingInDist = session.heading && entries.some(([k]) => k === session.heading);
      const primaryPillar = headingInDist
        ? (session.heading as Pillar)
        : entries.reduce((best, e) => (e[1] > best[1] ? e : best))[0];
      return entries.map(([pillar]) => ({
        pillar,
        primary: pillar === primaryPillar,
        deep_work: false,
      }));
    }
  }

  const tags = (session.tags ?? []).filter((t): t is Pillar => VALID_PILLARS.has(t as Pillar));
  if (tags.length > 0) {
    return tags.map(pillar => ({
      pillar,
      primary: pillar === session.heading,
      deep_work: false,
    }));
  }

  if (session.heading && VALID_PILLARS.has(session.heading as Pillar)) {
    return [{ pillar: session.heading as Pillar, primary: true, deep_work: false }];
  }

  return [];
}
