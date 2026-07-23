// Shared types + constants for the IntentionsPage refactor cluster.
//
// Pure data — no JSX, no React. All sub-components in components/intentions/
// import from here so the type definitions stay in one place.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import type { Intention, Pillar } from '../../types/api.ts';

// Focus dot/bar colors. These are the 5 colors from the desktop redesign
// handoff (`Journada (3).zip`, intentions_redesign), remapped to our actual
// pillar names. The handoff's "Escapes" vertex doesn't match our taxonomy —
// we have "Stand-up" instead, and assign it copper since copper was the
// 5th unused color in the handoff palette.
export const FOCUS_COLORS: Record<Pillar, string> = {
  standup:     '#C4915F', // copper
  passing:     '#DA7422', // brand orange
  pins:        '#A8CB72', // light green (handoff "TopControl")
  submissions: '#52B56C', // green
  guard:       '#D4A040', // warm yellow
};

export const PILLAR_LABEL: Record<Pillar, string> = {
  standup:     'Stand-up',
  passing:     'Passing',
  pins:        'Pins',
  submissions: 'Submissions',
  guard:       'Guard',
};

export const ALL_PILLARS: Pillar[] = ['standup', 'passing', 'pins', 'submissions', 'guard'];

export type IntentionsLayout = 'timeline' | 'eras';
export type FocusFilter = 'All' | Pillar;

// One slot in the single-year timeline. When filter='All' we render every ISO
// Monday in the selected year (capped at this-week for the current year), so
// gaps without an intention show up as muted "no focus set" rows. When a focus
// filter is active we drop the skeleton and only emit intention rows.
export type TimelineRow =
  | { type: 'intention'; weekStart: string; intention: Intention }
  | { type: 'empty';     weekStart: string };

// Per-intention derived display data — computed once at the page level so
// timeline rows + era card stats + bar chart all read from the same source.
export interface IntentionStats {
  sessionCount: number;       // # of sessions logged in the intention's date window
  alignment: number;          // 0–100, % of training hours matching intention.heading
  // Hours fields back the era-level hours-weighted alignment. Without them
  // EraStats would simple-average per-week scores, which overstates alignment
  // on uneven eras (1h@100% + 10h@50% would read 75% instead of the correct 55%).
  matchHours: number;         // hours trained on intention.heading in the window
  totalHours: number;         // total hours trained in the window (all pillars)
}

export interface Era {
  focus: Pillar;
  weeks: Intention[];     // newest-first within the era
  firstWk: string;        // newest week_start (chronologically latest)
  lastWk: string;         // oldest week_start (chronologically earliest)
}
