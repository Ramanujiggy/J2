// analyticsModels.ts — Advanced analytical models for BJJ training data.
//
// Two models, both computed from existing training_sessions data:
//   1. Skill Entropy (Shannon Diversity Index) — training balance (Atlas Prism)
//   2. Telemetry — acute (7d) vs chronic (28d) snapshot (homepage Telemetry card)
//
// The Skill Recency Decay and ACWR models were removed in the 2026-07-24
// cleanup pass once their only consumer (the retired /analytics + an unused
// PathAheadPage block) was gone. Recover from git history if they return.

import { SKILL_TAGS } from './constants.ts';
import type { SessionSummary } from '../types/api.ts';
import { sessionPillarHours, sessionDateKey } from './analyticsUtils.ts';

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

// ── 2. Telemetry — acute (7d) vs chronic (28d) snapshot ────────────────────
//
// Drives the homepage Training Telemetry card. Aligns with ACWR's windows
// so the user has one mental model for "recent vs baseline" across the app.
//
//   acute     = last 7 days
//   chronic28 = last 28 days
//   chronicPerWeek = chronic28 / 4 (averaged per week — comparable to acute)
//
// We report acute as the headline (what's happening now) and surface a
// delta vs the per-week chronic baseline so the user sees whether they're
// up, down, or steady relative to their typical week.

export interface TelemetryWindowStats {
  count: number;
  totalMinutes: number;
  /** Pillar with the most hours in this window. null if no tagged sessions. */
  topPillarLabel: string | null;
  topPillarHours: number;
  /** Second-place pillar — surfaced for "splitting time between X and Y" narrative. */
  secondPillarLabel: string | null;
}

export interface TelemetryResult {
  acute: TelemetryWindowStats;
  /** Per-week averages from the 28d window. Direct comparison to `acute`. */
  chronicPerWeek: { count: number; totalMinutes: number };
  /**
   * Delta of acute vs chronicPerWeek as a fraction (e.g. 0.30 = +30%).
   * null when chronic baseline has too little data to be meaningful.
   */
  sessionDelta: number | null;
  minutesDelta: number | null;
  /** True when the chronic window has enough sessions to anchor a comparison. */
  hasBaseline: boolean;
}

const TELEMETRY_BASELINE_MIN_SESSIONS = 4; // need at least one session/week on average

function computeWindowStats(
  sessions: SessionSummary[],
  startMs: number,
  endMs: number,
): TelemetryWindowStats {
  let count = 0;
  let totalMinutes = 0;
  const pillarHours: Record<string, number> = {};

  for (const s of sessions) {
    const iso = sessionDateKey(s);
    const dateMs = new Date(iso + 'T00:00:00').getTime();
    if (dateMs < startMs || dateMs > endMs) continue;
    count++;
    totalMinutes += s.duration ?? 0;
    const ph = sessionPillarHours(s);
    for (const [k, v] of Object.entries(ph)) pillarHours[k] = (pillarHours[k] ?? 0) + v;
  }

  const sorted = Object.entries(pillarHours).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  const labelFor = (key: string) => SKILL_TAGS.find(t => t.value === key)?.label ?? key;

  return {
    count,
    totalMinutes,
    topPillarLabel: top ? labelFor(top[0]) : null,
    topPillarHours: top ? top[1] : 0,
    secondPillarLabel: second ? labelFor(second[0]) : null,
  };
}

export function computeTelemetry(
  sessions: SessionSummary[],
  today: Date = new Date(),
): TelemetryResult {
  const todayMs = today.getTime();
  const msPerDay = 86_400_000;
  const acuteStart   = todayMs - 7  * msPerDay;
  const chronicStart = todayMs - 28 * msPerDay;

  const acute   = computeWindowStats(sessions, acuteStart,   todayMs);
  const chronic = computeWindowStats(sessions, chronicStart, todayMs);

  const chronicPerWeek = {
    count: chronic.count / 4,
    totalMinutes: chronic.totalMinutes / 4,
  };

  const hasBaseline = chronic.count >= TELEMETRY_BASELINE_MIN_SESSIONS;
  const sessionDelta = hasBaseline && chronicPerWeek.count > 0
    ? (acute.count - chronicPerWeek.count) / chronicPerWeek.count
    : null;
  const minutesDelta = hasBaseline && chronicPerWeek.totalMinutes > 0
    ? (acute.totalMinutes - chronicPerWeek.totalMinutes) / chronicPerWeek.totalMinutes
    : null;

  return { acute, chronicPerWeek, sessionDelta, minutesDelta, hasBaseline };
}
