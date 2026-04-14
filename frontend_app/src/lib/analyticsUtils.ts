import { SKILL_TAGS, MONTH_NAMES } from './constants.ts';
import type { SessionSummary, Intention } from '../types/api.ts';

// ── Time windows ─────────────────────────────────────────────────────────────

export type TimeWindow = '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom';

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

/** Returns the most-trained skill tag and its count within an intention's date window. */
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
    const d = typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10);
    if (d >= start && d <= endStr) {
      s.tags?.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
    }
  });

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const label = SKILL_TAGS.find(s => s.value === top[0])?.label ?? top[0];
  return { label, value: top[0], count: top[1] };
}

// ── Alignment ────────────────────────────────────────────────────────────────

/**
 * Determines whether an intention's focus aligns with actual training.
 *
 * When the intention has a `heading` (pillar vertex), uses reliable
 * pillar-to-pillar matching against the top trained tag.
 * Falls back to word-overlap heuristic for legacy intentions without heading.
 */
export function computeAlignment(
  intention: Pick<Intention, 'heading' | 'intent_label'>,
  topTag: { label: string; value: string } | null,
): 'aligned' | 'diverged' | 'no-data' {
  if (!topTag) return 'no-data';

  // Pillar-to-pillar: reliable when heading is set
  if (intention.heading) {
    return intention.heading === topTag.value ? 'aligned' : 'diverged';
  }

  // Legacy fallback: word overlap (for old intentions without heading)
  const norm = (s: string) => s.toLowerCase();
  const intentWords = norm(intention.intent_label).split(/\W+/).filter(w => w.length > 3);
  const focusWords  = norm(topTag.label).split(/\W+/).filter(w => w.length > 3);
  const match = intentWords.some(w => focusWords.includes(w)) || focusWords.some(w => intentWords.includes(w));
  return match ? 'aligned' : 'diverged';
}
