import { INT_COLORS } from './theme.ts';

// ── Date helpers ───────────────────────────────────────────────────────────

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ISO Monday (YYYY-MM-DD) for a given date, using local timezone
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateString(d);
}

// Adds (days - 1) days to a YYYY-MM-DD string (start day counts as day 1)
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days - 1);
  return toDateString(d);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const INTENSITY_COLOR: Record<number, string> = INT_COLORS;

export const SESSION_TYPE_LABELS: Record<string, string> = {
  class:                'Class',
  drilling:             'Drilling',
  competition_training: 'Competition',
};

// ── Gi / No-Gi helpers (mig 025 — 'both' added) ────────────────────────────
//
// 'both' captures sessions that mixed gi and no-gi work in one block. For
// display we render a compact "Gi + No-Gi" label; for analytics rollups we
// weight each side at 0.5 so the totals don't double-count.

export type GiNoGi = 'gi' | 'no_gi' | 'both';

export function formatGiNogi(value: GiNoGi | string | null | undefined): string {
  if (value === 'gi')    return 'Gi';
  if (value === 'no_gi') return 'No-Gi';
  if (value === 'both')  return 'Gi + No-Gi';
  return '';
}

/** Share of this session that should count toward the gi rollup. */
export function giShare(value: GiNoGi | string | null | undefined): number {
  if (value === 'gi')   return 1;
  if (value === 'both') return 0.5;
  return 0;
}

/** Share of this session that should count toward the no-gi rollup. */
export function nogiShare(value: GiNoGi | string | null | undefined): number {
  if (value === 'no_gi') return 1;
  if (value === 'both')  return 0.5;
  return 0;
}
