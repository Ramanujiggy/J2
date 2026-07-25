// Stamp die catalog — the single source of truth for the Boa seal collection.
//
// Each die's STATIC identity (art inputs + copy) lives here; the per-strike
// dynamic bits (the date in the chord band, the "Nth time" meta line) are
// computed at render time from the EarnedStamp record via the helpers below.
//
// `key` === the backend `die_key`. The backend keeps a parallel allowlist in
// backend_api/src/lib/stampDieKeys.ts — keep the two in sync.
//
// Ink rule: every die is one flat ink, no glow (it's a rubber die, not metal).
// The ONE exception is the prestige `eight_gates_26` capstone, which carries an
// electric-blue glow (`prestige: true`) — a deliberate, singular break from the
// rule, matching the app's existing PRESTIGE_BLUE milestone language.

import { PRESTIGE_BLUE } from './theme.ts';

export type BandTreatment = 'outline' | 'fill';

export interface StampDie {
  key: string;
  /** Straight type above the hand. */
  sub: string;
  /** Flat ink color (on dark surfaces). */
  col: string;
  /** Reveal-sheet title. */
  name: string;
  /** Reveal-sheet explanation. May contain <i>. */
  why: string;
  /** Chord-band treatment: 'outline' on dark (default), 'fill' on paper. */
  band: BandTreatment;
  /** Hand overrides — leave undefined to use the locked 8 / 1 "from lower-right". */
  ang?: number;
  flip?: number;
  /** Electric-blue glow exception (prestige capstone only). */
  prestige?: boolean;
  /** How the die is earned — drives where/whether it's struck. */
  earnRule: 'manual' | 'auto';
}

export const STAMP_DIES: Record<string, StampDie> = {
  boa: {
    key: 'boa',
    sub: 'A MAT MOMENT',
    col: '#D9A468',
    name: 'Boa',
    why: 'You marked a moment worth keeping. <i>Boa</i> — what gets called out across the mat when something works.',
    band: 'outline',
    earnRule: 'manual',
  },
  eight_gates_26: {
    key: 'eight_gates_26',
    sub: 'EIGHT GATES',
    col: PRESTIGE_BLUE,
    name: 'Eight Gates',
    why: 'Twenty-six weeks on the mat, every week. Nobody handed this to you and nobody can take it back.',
    band: 'outline',
    prestige: true,
    earnRule: 'auto',
  },
};

/** Ordered list for the collection view (earned first is decided at render). */
export const DIE_KEYS = Object.keys(STAMP_DIES);

// ── Per-strike dynamic rendering helpers ────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/** The chord-band date, e.g. "JULY 21 · 2026". */
export function bandDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]!.toUpperCase()} ${d.getDate()} · ${d.getFullYear()}`;
}

/**
 * The reveal-sheet meta line, e.g. "Struck July 21 · 2026 — 4th time".
 * Auto-earned dies are capped at one strike, so they read "once" instead.
 */
export function struckMeta(iso: string, count: number, autoEarned: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()} · ${d.getFullYear()}`;
  if (autoEarned || count <= 1) {
    return count <= 1 && !autoEarned ? `Struck ${date}` : `Struck ${date} — once`;
  }
  return `Struck ${date} — ${ordinal(count)} time`;
}
