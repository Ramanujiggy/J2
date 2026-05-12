// analyticsModels.ts — Advanced analytical models for BJJ training data.
//
// Three models, all computed from existing training_sessions data:
//   1. Skill Entropy (Shannon Diversity Index) — training balance
//   2. Skill Recency Decay (Ebbinghaus forgetting curve) — skill freshness
//   3. ACWR (Acute-to-Chronic Workload Ratio) — readiness / injury risk

import { SKILL_TAGS } from './constants.ts';
import type { SessionSummary } from '../types/api.ts';
import { sessionPillarHours } from './analyticsUtils.ts';

// ── 1. Skill Entropy (Shannon Diversity Index) ───────────────────────────────
//
// Measures how evenly distributed training is across all 5 pillars.
//   H = 0   → all training in one pillar (specialist)
//   H = 1   → perfectly even across all 5 (generalist)
//   H ≈ 0.6 → focused but not neglecting other areas

export interface EntropyResult {
  /** Normalized entropy in [0, 1]. null if no tagged training. */
  score: number | null;
  label: 'Specialist' | 'Focused' | 'Balanced' | 'Well-rounded' | null;
}

export function computeEntropy(hoursMap: Record<string, number>): EntropyResult {
  const values = SKILL_TAGS.map(t => hoursMap[t.value] ?? 0);
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return { score: null, label: null };

  const N = SKILL_TAGS.length; // 5
  let rawEntropy = 0;
  for (const v of values) {
    if (v > 0) {
      const p = v / total;
      rawEntropy -= p * Math.log(p);
    }
  }
  // Normalize by ln(N) so result is in [0, 1]
  const score = rawEntropy / Math.log(N);
  const clamped = Math.round(score * 100) / 100;

  let label: EntropyResult['label'];
  if (clamped < 0.3) label = 'Specialist';
  else if (clamped < 0.55) label = 'Focused';
  else if (clamped < 0.8) label = 'Balanced';
  else label = 'Well-rounded';

  return { score: clamped, label };
}

// ── 2. Skill Recency Decay (Exponential Forgetting Curve) ────────────────────
//
// For each pillar, how "fresh" is the training?
//   Retention = e^(-t / τ)
//   τ = BASE_TAU + SCALE * ln(1 + total_hours)
//
// More cumulative hours → slower decay (mastery = retention).

const BASE_TAU = 7;   // 1 week base decay constant (days)
const SCALE    = 14;  // Each doubling of cumulative hours adds ~14 days of retention

export interface DecayResult {
  pillar: string;
  label: string;
  retention: number;    // 0.0 to 1.0
  daysSince: number;    // days since last training
  totalHours: number;   // cumulative hours in this pillar
  tau: number;          // time constant (days)
}

export function computeDecay(
  sessions: SessionSummary[],
  today: Date = new Date(),
): DecayResult[] {
  const todayMs = today.getTime();

  return SKILL_TAGS.map(tag => {
    // Total hours = proportional contribution from every session that touched this pillar.
    // Last date = most recent session with non-zero contribution to this pillar.
    let totalHours = 0;
    let lastDateMs = 0;

    for (const s of sessions) {
      const ph = sessionPillarHours(s);
      const contribution = ph[tag.value];
      if (!contribution || contribution <= 0) continue;
      totalHours += contribution;
      const dateMs = new Date(
        (typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10)) + 'T00:00:00'
      ).getTime();
      if (dateMs > lastDateMs) lastDateMs = dateMs;
    }

    if (totalHours <= 0 || lastDateMs === 0) {
      return { pillar: tag.value, label: tag.label, retention: 0, daysSince: Infinity, totalHours: 0, tau: BASE_TAU };
    }

    const daysSince = Math.max(0, (todayMs - lastDateMs) / 86_400_000);
    const tau = BASE_TAU + SCALE * Math.log(1 + totalHours);
    const retention = Math.exp(-daysSince / tau);

    return {
      pillar: tag.value,
      label: tag.label,
      retention: Math.round(retention * 100) / 100,
      daysSince: Math.round(daysSince),
      totalHours: Math.round(totalHours * 10) / 10,
      tau: Math.round(tau * 10) / 10,
    };
  });
}

/** Returns the pillar with the lowest retention (most "rusty"). null if no training data. */
export function rustiest(decay: DecayResult[]): DecayResult | null {
  const withData = decay.filter(d => d.totalHours > 0);
  if (withData.length === 0) return null;
  return withData.reduce((min, d) => d.retention < min.retention ? d : min);
}

// ── 3. ACWR (Acute-to-Chronic Workload Ratio) ───────────────────────────────
//
// Training load = duration × intensity (training impulse).
// Acute  = last 7 days of load.
// Chronic = last 28 days of load / 4 (weekly average).
// ACWR   = Acute / Chronic.
//
//   < 0.8  → undertrained / deloading
//   0.8–1.3 → sweet spot (progressive overload)
//   > 1.5  → spike zone (injury risk)

export interface ACWRResult {
  acute: number;          // 7-day load
  chronic: number;        // 28-day weekly average load
  ratio: number | null;   // Acute / Chronic, null if no chronic data
  zone: 'deload' | 'sweet-spot' | 'caution' | 'danger' | 'no-data';
}

export function computeACWR(
  sessions: SessionSummary[],
  today: Date = new Date(),
): ACWRResult {
  const todayMs = today.getTime();
  const msPerDay = 86_400_000;
  const acute7  = todayMs - 7 * msPerDay;
  const chronic28 = todayMs - 28 * msPerDay;

  let acuteLoad = 0;
  let chronicLoad = 0;

  for (const s of sessions) {
    const dateMs = new Date(
      (typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10)) + 'T00:00:00'
    ).getTime();

    if (dateMs > todayMs) continue; // future sessions don't count

    const load = (s.duration ?? 0) * (s.intensity ?? 3); // minutes × intensity

    if (dateMs >= acute7) acuteLoad += load;
    if (dateMs >= chronic28) chronicLoad += load;
  }

  const chronicWeekly = chronicLoad / 4; // 28 days = 4 weeks

  if (chronicWeekly < 1) {
    return { acute: acuteLoad, chronic: chronicWeekly, ratio: null, zone: 'no-data' };
  }

  const ratio = Math.round((acuteLoad / chronicWeekly) * 100) / 100;

  let zone: ACWRResult['zone'];
  if (ratio < 0.8) zone = 'deload';
  else if (ratio <= 1.3) zone = 'sweet-spot';
  else if (ratio <= 1.5) zone = 'caution';
  else zone = 'danger';

  return { acute: Math.round(acuteLoad), chronic: Math.round(chronicWeekly), ratio, zone };
}

// ── 4. Per-Pillar ACWR ──────────────────────────────────────────────────────
//
// Same ACWR formula, but the load is partitioned across pillars using each
// session's pillar_distribution (or even-split fallback).
//
//   per_pillar_load = duration × intensity × weight_pillar
//
// Surfaces injury risk that the global ACWR misses — e.g. total mat hours are
// stable but standup volume tripled for a competition push, suggesting knee
// strain risk even though overall load looks fine.

export interface PillarACWRResult {
  pillar: string;
  label: string;
  acute: number;
  chronic: number;
  ratio: number | null;
  zone: ACWRResult['zone'];
}

export function computeACWRByPillar(
  sessions: SessionSummary[],
  today: Date = new Date(),
): PillarACWRResult[] {
  const todayMs = today.getTime();
  const msPerDay = 86_400_000;
  const acute7 = todayMs - 7 * msPerDay;
  const chronic28 = todayMs - 28 * msPerDay;

  // Initialize per-pillar buckets
  const acute: Record<string, number> = {};
  const chronic: Record<string, number> = {};
  for (const tag of SKILL_TAGS) { acute[tag.value] = 0; chronic[tag.value] = 0; }

  for (const s of sessions) {
    const dateMs = new Date(
      (typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10)) + 'T00:00:00'
    ).getTime();
    if (dateMs > todayMs) continue;

    const intensity = s.intensity ?? 3;
    const ph = sessionPillarHours(s); // pillar → hours
    const inAcute = dateMs >= acute7;
    const inChronic = dateMs >= chronic28;
    if (!inChronic) continue;

    for (const [pillar, hours] of Object.entries(ph)) {
      if (!(pillar in acute)) continue;
      const load = hours * 60 * intensity; // back to minutes × intensity for parity with global ACWR
      if (inAcute) acute[pillar] += load;
      chronic[pillar] += load;
    }
  }

  return SKILL_TAGS.map(tag => {
    const a = acute[tag.value] ?? 0;
    const cWeekly = (chronic[tag.value] ?? 0) / 4;
    if (cWeekly < 1) {
      return { pillar: tag.value, label: tag.label, acute: Math.round(a), chronic: Math.round(cWeekly), ratio: null, zone: 'no-data' as const };
    }
    const ratio = Math.round((a / cWeekly) * 100) / 100;
    let zone: ACWRResult['zone'];
    if (ratio < 0.8) zone = 'deload';
    else if (ratio <= 1.3) zone = 'sweet-spot';
    else if (ratio <= 1.5) zone = 'caution';
    else zone = 'danger';
    return { pillar: tag.value, label: tag.label, acute: Math.round(a), chronic: Math.round(cWeekly), ratio, zone };
  });
}

/** Returns the pillar with the highest danger ratio, or null if all are no-data/safe. */
export function spikiestPillar(perPillar: PillarACWRResult[]): PillarACWRResult | null {
  const candidates = perPillar.filter(p => p.ratio != null && (p.zone === 'caution' || p.zone === 'danger'));
  if (candidates.length === 0) return null;
  return candidates.reduce((max, p) => (p.ratio ?? 0) > (max.ratio ?? 0) ? p : max);
}
