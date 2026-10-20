import { SKILL_TAGS, MONTH_NAMES } from './constants.ts';
import type { SessionSummary, Intention } from '../types/api.ts';
import { addDays } from './sessionUtils.ts';

// ── Date normalisation ───────────────────────────────────────────────────────

/** YYYY-MM-DD key for a session's `date` field. In practice the backend always
 *  sends a string, so the `.slice(0, 10)` branch is the hot path; the `Date`
 *  branch is a defensive fallback that shouldn't fire in production. Used by
 *  every analytics rollup that buckets sessions by day. */
export function sessionDateKey(s: { date: string | Date }): string {
  return typeof s.date === 'string'
    ? s.date.slice(0, 10)
    : new Date(s.date).toISOString().slice(0, 10);
}

// ── Time windows ─────────────────────────────────────────────────────────────

export type TimeWindow = '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'all' | 'custom';

// 'all' has no entry — falsy lookup → no cutoff → unfiltered (career-long).
export const WINDOW_DAYS: Partial<Record<TimeWindow, number>> = {
  '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180, '1y': 365,
};

// ── Date formatting ──────────────────────────────────────────────────────────

/** Short format for table cells: "Apr 7" */
export function formatWeekShort(weekStart: string): string {
  const d = new Date(weekStart.slice(0, 10) + 'T00:00:00');
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** Long format for journal headers: "Week of Apr 7, 2025" */
export function formatWeekLong(weekStart: string): string {
  const d = new Date(weekStart.slice(0, 10) + 'T00:00:00');
  return `Week of ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ── Training telemetry ───────────────────────────────────────────────────────

/**
 * Returns the per-pillar HOURS contribution of a single session, using:
 *   1. `pillar_distribution` if present — proportional split (zero-sum, accurate)
 *   2. else even split across `tags` — legacy fallback
 *   3. else `{}` — session contributes nothing to pillar aggregates
 *
 * Sum of returned values always equals the session's total hours.
 */
export function sessionPillarHours(s: SessionSummary): Record<string, number> {
  const totalHours = (s.duration ?? 0) / 60;
  if (totalHours <= 0) return {};

  // Preferred: persisted distribution (server renormalized; sums to ~1)
  const dist = s.pillar_distribution;
  if (dist && typeof dist === 'object') {
    const out: Record<string, number> = {};
    let sum = 0;
    for (const [k, v] of Object.entries(dist)) {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n) && n > 0) { out[k] = n; sum += n; }
    }
    if (sum > 0) {
      // Scale to actual hours (and re-normalize against drift defensively)
      const scale = totalHours / sum;
      for (const k of Object.keys(out)) out[k] = out[k]! * scale;
      return out;
    }
  }

  // Legacy fallback: even split across tags
  const tags = s.tags?.filter(t => !!t) ?? [];
  if (tags.length === 0) return {};
  const per = totalHours / tags.length;
  const out: Record<string, number> = {};
  for (const t of tags) out[t] = (out[t] ?? 0) + per;
  return out;
}

/** Returns the most-trained skill tag (by proportional hours) within an intention's date window. */
export function topTagInRange(
  sessions: SessionSummary[],
  weekStart: string,
  durationDays: number,
): { label: string; value: string; count: number } | null {
  const start = weekStart.slice(0, 10);
  const end = new Date(start + 'T00:00:00');
  end.setDate(end.getDate() + durationDays - 1);
  const endStr = end.toISOString().slice(0, 10);

  const counts: Record<string, number> = {};
  sessions.forEach(s => {
    const d = sessionDateKey(s);
    if (d < start || d > endStr) return;
    const ph = sessionPillarHours(s);
    for (const [k, v] of Object.entries(ph)) counts[k] = (counts[k] ?? 0) + v;
  });

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const label = SKILL_TAGS.find(s => s.value === top[0])?.label ?? top[0];
  return { label, value: top[0], count: top[1] };
}

// ── Alignment ────────────────────────────────────────────────────────────────

export interface AlignmentResult {
  status: 'aligned' | 'diverged' | 'no-data';
  /** Percentage of training hours matching the intention heading (0–100). null when no data or no heading. */
  score: number | null;
}

/**
 * Determines whether an intention's focus aligns with actual training.
 * Returns both a status label and a graduated score (% of hours on-intention).
 */
export function computeAlignment(
  intention: Pick<Intention, 'heading' | 'intent_label'>,
  topTag: { label: string; value: string } | null,
  /** Hours-weighted counts per tag for the intention window (from topTagInRange aggregation). */
  tagHours?: Record<string, number>,
): AlignmentResult {
  if (!topTag) return { status: 'no-data', score: null };

  // Graduated score: what % of total hours matched the intention heading?
  let score: number | null = null;
  if (intention.heading && tagHours) {
    const totalHours = Object.values(tagHours).reduce((a, b) => a + b, 0);
    const matchHours = tagHours[intention.heading] ?? 0;
    score = totalHours > 0 ? Math.round((matchHours / totalHours) * 100) : 0;
  }

  // Pillar-to-pillar: reliable when heading is set
  if (intention.heading) {
    const status = intention.heading === topTag.value ? 'aligned' : 'diverged';
    return { status, score };
  }

  // Legacy fallback: word overlap (for old intentions without heading)
  const norm = (s: string) => s.toLowerCase();
  const intentWords = norm(intention.intent_label).split(/\W+/).filter(w => w.length > 3);
  const focusWords  = norm(topTag.label).split(/\W+/).filter(w => w.length > 3);
  const match = intentWords.some(w => focusWords.includes(w)) || focusWords.some(w => intentWords.includes(w));
  return { status: match ? 'aligned' : 'diverged', score: null };
}

/**
 * Builds proportional pillar hours for sessions within an intention's date window.
 * Uses pillar_distribution when present; falls back to even-split across tags.
 * Sum equals total hours trained in the window (zero-sum).
 */
export function tagHoursInRange(
  sessions: SessionSummary[],
  weekStart: string,
  durationDays: number,
): Record<string, number> {
  const start = weekStart.slice(0, 10);
  const end = new Date(start + 'T00:00:00');
  end.setDate(end.getDate() + durationDays - 1);
  const endStr = end.toISOString().slice(0, 10);

  const counts: Record<string, number> = {};
  sessions.forEach(s => {
    const d = sessionDateKey(s);
    if (d < start || d > endStr) return;
    const ph = sessionPillarHours(s);
    for (const [k, v] of Object.entries(ph)) counts[k] = (counts[k] ?? 0) + v;
  });
  return counts;
}

// ── Intention completion (mig 034) ──────────────────────────────────────────
//
// Intentions can complete via three mechanisms:
//   • 'days'           — purely calendar; never "completed early"
//   • 'sessions'       — completes after N sessions touching the intention's
//                        heading (or, if heading is null, any session)
//   • 'training_weeks' — completes after N distinct ISO weeks containing
//                        >= 1 session since week_start
//
// `isIntentionComplete` lets the active-intention picker drop a non-'days'
// intention from the active slot once the target has been reached, even if
// the soft calendar ceiling hasn't elapsed yet.

export interface IntentionProgress {
  completed: number;
  target: number;
  unit: 'sessions' | 'training_weeks';
}

function isoWeekKey(dateStr: string): string {
  // YYYY-Www. Uses Thursday-of-week trick to mirror ISO 8601.
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function sessionTouchesHeading(s: SessionSummary, heading: string): boolean {
  // Distribution-first: if the session has pillar_distribution, the heading
  // counts when its weight is > 0. Else legacy: heading field or tags array.
  const dist = (s as unknown as { pillar_distribution?: Record<string, number> | null }).pillar_distribution;
  if (dist && typeof dist === 'object') {
    return (dist[heading] ?? 0) > 0;
  }
  if (s.heading === heading) return true;
  const tags = (s as unknown as { tags?: string[] | null }).tags;
  return Array.isArray(tags) && tags.includes(heading);
}

export function computeIntentionProgress(
  intention: Intention,
  sessions: SessionSummary[],
): IntentionProgress | null {
  if (intention.completion_type === 'days' || intention.target_count == null) return null;
  const start = intention.week_start.slice(0, 10);

  if (intention.completion_type === 'sessions') {
    let count = 0;
    for (const s of sessions) {
      const d = sessionDateKey(s);
      if (d < start) continue;
      // If a heading is set, only sessions touching that pillar count.
      // If null, any session counts (generic consistency intention).
      if (intention.heading && !sessionTouchesHeading(s, intention.heading)) continue;
      count++;
    }
    return { completed: count, target: intention.target_count, unit: 'sessions' };
  }

  // 'training_weeks'
  const weeks = new Set<string>();
  for (const s of sessions) {
    const d = sessionDateKey(s);
    if (d < start) continue;
    weeks.add(isoWeekKey(d));
  }
  return { completed: weeks.size, target: intention.target_count, unit: 'training_weeks' };
}

export function isIntentionComplete(intention: Intention, sessions: SessionSummary[]): boolean {
  const progress = computeIntentionProgress(intention, sessions);
  if (!progress) return false;
  return progress.completed >= progress.target;
}

/**
 * The one intention that owns today. Every surface (home, rail, journal,
 * intentions page) reads it through here so they never disagree.
 *
 * Covers today = todayStr falls inside [week_start, week_start + duration_days - 1].
 * When `sessions` is given, a 'sessions' / 'training_weeks' intention that has
 * already hit its target leaves the slot early. When several still qualify,
 * the most recently started wins: it is the one the user set last.
 */
export function pickActiveIntention(
  intentions: Intention[],
  todayStr: string,
  sessions?: SessionSummary[],
): Intention | null {
  let best: Intention | null = null;
  for (const i of intentions) {
    const start = i.week_start.slice(0, 10);
    const end = addDays(start, (i.duration_days ?? 7) - 1);
    if (todayStr < start || todayStr > end) continue;
    if (sessions && i.completion_type !== 'days' && isIntentionComplete(i, sessions)) continue;
    if (!best || start > best.week_start.slice(0, 10)) best = i;
  }
  return best;
}
