// Home view-model — pure derivations behind the "table of contents" home.
//
// Home leads with the user's own writing: the entry they haven't finished,
// the last few things they wrote, and a portrait of their game. These
// functions turn the raw session list into exactly those three shapes.
// Kept pure (no React, no Date.now defaults) so they can be unit-tested.

import type { PillarDistribution, SessionSummary } from '../types/api.ts';
import { toDateString } from './sessionUtils.ts';

/** Sessions whose logged date is more than this old stop owning the hero. */
const UNFINISHED_MAX_AGE_DAYS = 7;

/** How much of the entry the hero / list quotes before trailing off. */
const EXCERPT_MAX_CHARS = 120;

/** SVG polygon count ceiling for the portrait — see portraitDistributions. */
const PORTRAIT_MAX_LAYERS = 60;

/** Normalised `YYYY-MM-DD` key for a session, whatever shape its date is in. */
export function sessionDateKey(s: SessionSummary): string {
  return typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
}

/** Newest first. Stable for same-day sessions (preserves input order). */
export function sortSessionsDesc(sessions: SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((a, b) => sessionDateKey(b).localeCompare(sessionDateKey(a)));
}

function hasWriting(s: SessionSummary): boolean {
  return !!s.notes && s.notes.trim().length > 0;
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(fromKey + 'T00:00:00').getTime();
  const b = new Date(toKey + 'T00:00:00').getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * The entry the user started but hasn't written yet — this owns the hero when
 * it exists ("a task beats a memory"). Only recent sessions qualify: an
 * unwritten session from two months ago is history, not a task, and letting it
 * sit in the hero forever would turn the card into a nag.
 */
export function findUnfinishedEntry(
  sessions: SessionSummary[],
  today: Date,
): SessionSummary | null {
  const todayKey = toDateString(today);
  for (const s of sortSessionsDesc(sessions)) {
    if (hasWriting(s)) continue;
    const age = daysBetween(sessionDateKey(s), todayKey);
    if (age < 0) continue;                       // future-dated — not yet a task
    if (age > UNFINISHED_MAX_AGE_DAYS) return null;  // sorted desc: older only
    return s;
  }
  return null;
}

export type MemoryTier = 'year_ago_today' | 'month_last_year' | 'most_sealed';

export interface MemoryEntry {
  session: SessionSummary;
  tier: MemoryTier;
  /** Pill copy for the hero card — the tier stated plainly. */
  label: string;
  /** 1-based ordinal of this session in the user's history ("your 11th session"). */
  ordinal: number;
}

/**
 * The resurfacing chain from the build brief, in order:
 *   1. an entry from a year ago today
 *   2. the same calendar month last year (closest day-of-month)
 *   3. the user's most-sealed entry
 * Only written entries resurface — the point is to be read.
 */
export function findMemoryEntry(
  sessions: SessionSummary[],
  today: Date,
): MemoryEntry | null {
  const written = sessions.filter(hasWriting);
  if (written.length === 0) return null;

  // Ordinal is over ALL sessions, oldest first — "your 11th session" counts
  // training, not writing.
  const chronological = sortSessionsDesc(sessions).slice().reverse();
  const ordinalOf = (s: SessionSummary) =>
    chronological.findIndex(c => c.id === s.id) + 1;

  const build = (session: SessionSummary, tier: MemoryTier, label: string): MemoryEntry => ({
    session, tier, label, ordinal: ordinalOf(session),
  });

  // 1 — a year ago today.
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const yearAgoKey = toDateString(yearAgo);
  const exact = written.find(s => sessionDateKey(s) === yearAgoKey);
  if (exact) return build(exact, 'year_ago_today', 'A year ago today');

  // 2 — same calendar month, previous year; closest day-of-month wins.
  const targetYear = today.getFullYear() - 1;
  const targetMonth = today.getMonth();
  const sameMonth = written
    .map(s => ({ s, d: new Date(sessionDateKey(s) + 'T00:00:00') }))
    .filter(({ d }) => d.getFullYear() === targetYear && d.getMonth() === targetMonth)
    .sort((a, b) =>
      Math.abs(a.d.getDate() - today.getDate()) - Math.abs(b.d.getDate() - today.getDate()));
  if (sameMonth.length > 0) {
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(sameMonth[0]!.d);
    return build(sameMonth[0]!.s, 'month_last_year', `${monthName} last year`);
  }

  // 3 — the most-sealed entry.
  const sealed = written
    .filter(s => (s.stamps?.length ?? 0) > 0)
    .sort((a, b) => (b.stamps?.length ?? 0) - (a.stamps?.length ?? 0));
  if (sealed.length > 0) return build(sealed[0]!, 'most_sealed', 'Worth keeping');

  return null;
}

export interface RecentEntry {
  session: SessionSummary;
  /** First line of what they wrote, trimmed. Null when nothing is written yet. */
  excerpt: string | null;
}

/**
 * The last `count` entries for the home list. Sessions with no notes are
 * INCLUDED with a null excerpt — without them the list silently drops training
 * days and stops being a truthful record of the week.
 */
export function buildRecentEntries(sessions: SessionSummary[], count = 3): RecentEntry[] {
  return sortSessionsDesc(sessions).slice(0, count).map(session => ({
    session,
    excerpt: excerptOf(session),
  }));
}

/** The quotable opening of an entry, truncated on a word boundary. */
export function excerptOf(
  session: SessionSummary,
  maxChars = EXCERPT_MAX_CHARS,
): string | null {
  const raw = session.notes?.trim();
  if (!raw) return null;
  const flat = raw.replace(/\s+/g, ' ');
  if (flat.length <= maxChars) return flat;
  const cut = flat.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/**
 * Pillar distributions for the portrait overlay, newest first and capped.
 * The cap is perceptual, not cosmetic: past ~60 translucent layers the shape
 * stops changing but the SVG keeps costing paint time on low-end phones.
 */
export function portraitDistributions(
  sessions: SessionSummary[],
  max = PORTRAIT_MAX_LAYERS,
): PillarDistribution[] {
  const out: PillarDistribution[] = [];
  for (const s of sortSessionsDesc(sessions)) {
    const d = s.pillar_distribution;
    if (d && Object.keys(d).length > 0) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}
