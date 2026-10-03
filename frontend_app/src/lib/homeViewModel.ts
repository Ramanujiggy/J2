// Home view-model — pure derivations behind the "table of contents" home.
//
// Home leads with the user's own writing: the entry they haven't finished,
// the last few things they wrote, and a portrait of their game. These
// functions turn the raw session list into exactly those three shapes.
// Kept pure (no React, no Date.now defaults) so they can be unit-tested.

import type { Intention, PillarDistribution, SessionSummary, UserTag } from '../types/api.ts';
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

export type MemoryTier =
  | 'year_ago_today'
  | 'month_last_year'
  | 'month_ago'
  | 'week_ago'
  | 'most_sealed'
  | 'earlier';

export interface MemoryEntry {
  session: SessionSummary;
  tier: MemoryTier;
  /** Pill copy for the hero card — the tier stated plainly. */
  label: string;
  /** 1-based ordinal of this session in the user's history ("your 11th session"). */
  ordinal: number;
}

/** How far either side of the target date a week/month memory may sit. */
const WEEK_TIER_TOLERANCE_DAYS = 3;
const MONTH_TIER_TOLERANCE_DAYS = 7;

/** Anything newer than this is still "now" — it wouldn't feel resurfaced. */
const MIN_MEMORY_AGE_DAYS = 5;

/**
 * The resurfacing chain, longest reach first:
 *   1. an entry from a year ago today
 *   2. the same calendar month last year (closest day-of-month)
 *   3. about a month ago
 *   4. about a week ago
 *   5. the user's most-sealed entry
 *   6. anything else they've written
 *
 * Tiers 3 and 4 exist because the cadence has to compress early: the payoff
 * must land in week one, and the first time someone reads their own
 * seven-day-old sentence is the conversion moment. Without them a user in
 * their first year has nothing to resurface at all.
 *
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

  const todayKey = toDateString(today);
  const dated = written.map(s => ({
    s,
    key: sessionDateKey(s),
    d: new Date(sessionDateKey(s) + 'T00:00:00'),
  }));

  // 1 — a year ago today.
  const yearAgoKey = toDateString(
    new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()),
  );
  const exact = dated.find(({ key }) => key === yearAgoKey);
  if (exact) return build(exact.s, 'year_ago_today', 'A year ago today');

  // 2 — same calendar month, previous year; closest day-of-month wins.
  const sameMonth = dated
    .filter(({ d }) => d.getFullYear() === today.getFullYear() - 1 && d.getMonth() === today.getMonth())
    .sort((a, b) =>
      Math.abs(a.d.getDate() - today.getDate()) - Math.abs(b.d.getDate() - today.getDate()));
  if (sameMonth.length > 0) {
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(sameMonth[0]!.d);
    return build(sameMonth[0]!.s, 'month_last_year', `${monthName} last year`);
  }

  // 3 / 4 — the compressed early cadence. Closest entry to the target age.
  const nearestTo = (targetAge: number, tolerance: number) => {
    const candidates = dated
      .map(entry => ({ ...entry, age: daysBetween(entry.key, todayKey) }))
      .filter(({ age }) => Math.abs(age - targetAge) <= tolerance)
      .sort((a, b) => Math.abs(a.age - targetAge) - Math.abs(b.age - targetAge));
    return candidates[0] ?? null;
  };

  const monthAgo = nearestTo(30, MONTH_TIER_TOLERANCE_DAYS);
  if (monthAgo) return build(monthAgo.s, 'month_ago', 'A month ago');

  const weekAgo = nearestTo(7, WEEK_TIER_TOLERANCE_DAYS);
  if (weekAgo) return build(weekAgo.s, 'week_ago', 'A week ago');

  // 5 — the most-sealed entry.
  const sealed = dated
    .filter(({ s }) => (s.stamps?.length ?? 0) > 0)
    .sort((a, b) => (b.s.stamps?.length ?? 0) - (a.s.stamps?.length ?? 0));
  if (sealed.length > 0) return build(sealed[0]!.s, 'most_sealed', 'Worth keeping');

  // 6 — anything they've written that isn't from the last few days. Better a
  // plain memory than an empty hero telling a writing user they've written
  // nothing.
  const earlier = dated
    .map(entry => ({ ...entry, age: daysBetween(entry.key, todayKey) }))
    .filter(({ age }) => age >= MIN_MEMORY_AGE_DAYS)
    .sort((a, b) => b.age - a.age);
  if (earlier.length > 0) return build(earlier[0]!.s, 'earlier', 'Earlier');

  return null;
}

export interface RecentEntry {
  session: SessionSummary;
  /** First line of what they wrote, trimmed. Null when nothing is written yet. */
  excerpt: string | null;
  /** True when the entry runs past the excerpt — the row trails off with "…". */
  truncated: boolean;
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
    truncated: isExcerptTruncated(session),
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

/** Whether `excerptOf` had to cut this entry short — drives the trailing "…". */
export function isExcerptTruncated(
  session: SessionSummary,
  maxChars = EXCERPT_MAX_CHARS,
): boolean {
  const excerpt = excerptOf(session, maxChars);
  if (!excerpt) return false;
  return (session.notes?.trim().replace(/\s+/g, ' ').length ?? 0) > excerpt.length;
}

/** How many recent sessions the technique anchor is measured against. */
const TECHNIQUE_WINDOW = 10;

export interface TechniqueCard {
  tag: UserTag;
  /** Sessions in the recent window that trained this technique. */
  recentCount: number;
  /** Size of that window — "four of your last ten". */
  windowSize: number;
}

/**
 * Techniques the user has classified as theirs to work on, for the hero deck.
 *
 * `learning` is literally "currently working on" in the library's own
 * vocabulary, so it ranks first; `go_to` follows as the other deliberate
 * classification. `shelved` never surfaces here, and neither does an
 * unclassified technique — an untouched row is library browsing, not a
 * first-person anchor, and the hero only ever shows the user their own work.
 */
export function buildTechniqueCards(
  tags: UserTag[],
  sessions: SessionSummary[],
  max = 3,
): TechniqueCard[] {
  const eligible = tags.filter(t => t.affinity === 'learning' || t.affinity === 'go_to');
  if (eligible.length === 0) return [];

  const window = sortSessionsDesc(sessions).slice(0, TECHNIQUE_WINDOW);
  const windowSize = window.length;

  const rank = (t: UserTag) => (t.affinity === 'learning' ? 0 : 1);

  return eligible
    .map(tag => ({
      tag,
      windowSize,
      recentCount: window.filter(s => (s.user_tag_ids ?? []).includes(tag.id)).length,
    }))
    .sort((a, b) => {
      if (rank(a.tag) !== rank(b.tag)) return rank(a.tag) - rank(b.tag);
      if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
      return a.tag.name.localeCompare(b.tag.name);
    })
    .slice(0, max);
}

/**
 * Intentions the user has already set, newest first, excluding the one
 * currently running (it has its own card) and anything dated ahead.
 */
export function findRecentIntentions(
  intentions: Intention[],
  activeIntentionId: string | null,
  today: Date,
  max = 2,
): Intention[] {
  const todayKey = toDateString(today);
  return intentions
    .filter(i => i.id !== activeIntentionId && i.week_start.slice(0, 10) <= todayKey)
    .sort((a, b) => b.week_start.slice(0, 10).localeCompare(a.week_start.slice(0, 10)))
    .slice(0, max);
}

/** Technique names an intention carries, resolved against the library. */
export function intentionTechniques(intention: Intention, tags: UserTag[]): UserTag[] {
  const ids = intention.user_tag_ids ?? [];
  if (ids.length === 0) return [];
  const byId = new Map(tags.map(t => [t.id, t]));
  return ids.map(id => byId.get(id)).filter((t): t is UserTag => !!t);
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
