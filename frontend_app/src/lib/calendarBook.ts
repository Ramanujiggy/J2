// The Calendar tab reads the year as a book: the year is told back in one
// sentence, the weeks stand on a shelf grouped by month, and the record is
// split into chapters — one per intention, plus the stretches between them. Pure functions only; the views live in components/calendar.

import { SKILL_TAGS } from './constants.ts';
import { getWeekStart, toDateString } from './sessionUtils.ts';
import { sessionDateKey, sessionTouchesHeading } from './analyticsUtils.ts';
import type { SessionSummary, Intention, BeltHistoryEntry } from '../types/api.ts';

export const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Shift a YYYY-MM-DD key by `days` calendar days (negative goes back). */
export function shiftDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Monday (YYYY-MM-DD) of the week holding `dateKey`. */
export function mondayOf(dateKey: string): string {
  return getWeekStart(new Date(dateKey + 'T00:00:00'));
}

export function pillarLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return SKILL_TAGS.find(t => t.value === value)?.label ?? value;
}

export function noteOf(s: SessionSummary): string {
  return s.notes?.trim() ?? '';
}

/** The first words of an entry, cut at a word boundary. */
export function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`;
}

/** The session in a set with the most written about it, if any has notes. */
export function mostWritten(sessions: SessionSummary[]): SessionSummary | null {
  let best: SessionSummary | null = null;
  for (const s of sessions) {
    const len = noteOf(s).length;
    if (len > 0 && (!best || len >= noteOf(best).length)) best = s;
  }
  return best;
}

export function totalMinutes(sessions: SessionSummary[]): number {
  return sessions.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
}

/** "19h", "45m", "2h 30m" — hours rounded to the half for long spans. */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  if (h >= 10) return `${Math.round(h)}h`;
  const whole = Math.floor(h);
  const rest = Math.round(minutes - whole * 60);
  return rest === 0 ? `${whole}h` : `${whole}h ${rest}m`;
}

// ── Chapters ────────────────────────────────────────────────────────────────

export interface Chapter {
  /** Intention id, `between-<start>` for time without one, `book-YYYY-MM` for a month read off the shelf. */
  key: string;
  kind: 'intention' | 'between' | 'month';
  /** The intention's own words, or the month's name. */
  title: string;
  pillar: string | null;
  /** First and last day of the chapter, inclusive (YYYY-MM-DD). */
  start: string;
  end: string;
  ongoing: boolean;
  /** 1-based order among the year's intention chapters; null for months. */
  number: number | null;
  intention: Intention | null;
  /** The chapter's sessions within the year, oldest first. */
  sessions: SessionSummary[];
}

/**
 * The day an intention stops owning the calendar: its planned last day, or
 * the day its target was met for 'sessions' / 'training_weeks' intentions.
 */
export function intentionEnd(intention: Intention, sortedSessions: SessionSummary[]): string {
  const start = intention.week_start.slice(0, 10);
  const planned = shiftDays(start, Math.max(1, intention.duration_days ?? 7) - 1);
  const target = intention.target_count;
  if (intention.completion_type === 'days' || target == null || target <= 0) return planned;
  let count = 0;
  const weeks = new Set<string>();
  for (const s of sortedSessions) {
    const d = sessionDateKey(s);
    if (d < start) continue;
    if (d > planned) break;
    if (intention.completion_type === 'sessions') {
      if (intention.heading && !sessionTouchesHeading(s, intention.heading)) continue;
      count++;
    } else {
      weeks.add(mondayOf(d));
      count = weeks.size;
    }
    if (count >= target) return d;
  }
  return planned;
}

export function buildChapters(
  sessions: SessionSummary[],
  intentions: Intention[],
  year: number,
  todayStr: string,
): Chapter[] {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const sorted = [...sessions]
    .filter(s => sessionDateKey(s).slice(0, 4) === String(year))
    .sort((a, b) => sessionDateKey(a).localeCompare(sessionDateKey(b)));

  // Intention ranges, oldest first; a later intention cuts an earlier one short.
  const ranges = intentions
    .map(i => ({ intention: i, start: i.week_start.slice(0, 10), end: intentionEnd(i, sorted) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < ranges.length - 1; i++) {
    const cur = ranges[i]!;
    const next = ranges[i + 1]!;
    if (next.start <= cur.end) cur.end = shiftDays(next.start, -1);
  }
  const inYear = ranges.filter(r => r.end >= r.start && r.end >= yearStart && r.start <= yearEnd);

  const covered = (d: string) => inYear.some(r => d >= r.start && d <= r.end);
  const chapters: Chapter[] = inYear.map((r, idx) => ({
    key: r.intention.id,
    kind: 'intention',
    title: r.intention.intent_label,
    pillar: pillarLabel(r.intention.heading),
    start: r.start,
    end: r.end,
    ongoing: todayStr >= r.start && todayStr <= r.end,
    number: idx + 1,
    intention: r.intention,
    sessions: sorted.filter(s => {
      const d = sessionDateKey(s);
      return d >= r.start && d <= r.end;
    }),
  }));

  // Time between intentions: one chapter per unbroken stretch that holds any
  // sessions. With no intentions at all, the year falls back to its months.
  const spans: { start: string; end: string }[] = [];
  let open: { start: string; end: string } | null = null;
  for (let d = yearStart; d <= yearEnd; d = shiftDays(d, 1)) {
    const breakHere = covered(d) || (inYear.length === 0 && d.endsWith('-01') && open !== null);
    if (breakHere && open) { spans.push(open); open = null; }
    if (covered(d)) continue;
    if (open) open.end = d;
    else open = { start: d, end: d };
  }
  if (open) spans.push(open);

  for (const span of spans) {
    const loose = sorted.filter(s => {
      const d = sessionDateKey(s);
      return d >= span.start && d <= span.end;
    });
    if (loose.length === 0) continue;
    const m1 = Number(span.start.slice(5, 7)) - 1;
    const m2 = Number(span.end.slice(5, 7)) - 1;
    chapters.push({
      key: `between-${span.start}`,
      kind: 'between',
      title: m1 === m2 ? MONTH_FULL[m1]! : `${MONTH_FULL[m1]} – ${MONTH_FULL[m2]}`,
      pillar: null,
      start: span.start,
      end: span.end,
      ongoing: todayStr >= span.start && todayStr <= span.end,
      number: null,
      intention: null,
      sessions: loose,
    });
  }

  return chapters.sort((a, b) => a.start.localeCompare(b.start));
}

/** Which week of its chapter a day falls in, counting the first as 1. */
export function weekOfChapter(chapter: Chapter, dateKey: string): number {
  const first = new Date(mondayOf(chapter.start) + 'T00:00:00').getTime();
  const that = new Date(mondayOf(dateKey) + 'T00:00:00').getTime();
  return Math.round((that - first) / (7 * 86_400_000)) + 1;
}

// ── The shelf ───────────────────────────────────────────────────────────────

export interface ShelfWeek {
  /** Monday of the week. */
  start: string;
  minutes: number;
  hard: boolean;
  isNow: boolean;
  future: boolean;
}

export interface ShelfBook {
  month: number;
  weeks: ShelfWeek[];
}

/** Every week of the year, grouped into one book per month (by its Thursday). */
export function buildShelf(sessions: SessionSummary[], year: number, todayStr: string): ShelfBook[] {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const byDay = new Map<string, { minutes: number; hard: boolean }>();
  for (const s of sessions) {
    const d = sessionDateKey(s);
    if (d < yearStart || d > yearEnd) continue;
    const prev = byDay.get(d) ?? { minutes: 0, hard: false };
    byDay.set(d, { minutes: prev.minutes + (Number(s.duration) || 0), hard: prev.hard || Number(s.intensity) >= 5 });
  }
  const books: ShelfBook[] = Array.from({ length: 12 }, (_, month) => ({ month, weeks: [] }));
  const thisMonday = mondayOf(todayStr);
  for (let start = mondayOf(yearStart); start <= yearEnd; start = shiftDays(start, 7)) {
    let minutes = 0;
    let hard = false;
    for (let i = 0; i < 7; i++) {
      const day = byDay.get(shiftDays(start, i));
      if (day) { minutes += day.minutes; hard = hard || day.hard; }
    }
    const thursday = shiftDays(start, 3);
    const month = thursday < yearStart ? 0 : thursday > yearEnd ? 11 : Number(thursday.slice(5, 7)) - 1;
    books[month]!.weeks.push({ start, minutes, hard, isNow: start === thisMonday, future: start > todayStr });
  }
  return books;
}

// ── The year, told back ─────────────────────────────────────────────────────

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Numbers under a hundred as words ("seventy-six"); larger ones as numerals. */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 100) return n.toLocaleString('en-US');
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 === 0 ? t : `${t}-${ONES[n % 10]}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export function promotionText(p: BeltHistoryEntry): string {
  const belt = capitalise(p.belt_rank);
  return p.stripes > 0
    ? `${capitalise(numberWords(p.stripes))} ${plural(p.stripes, 'stripe')} on the ${p.belt_rank}`
    : `${belt} belt`;
}

export function yearSentence(opts: {
  year: number;
  isCurrentYear: boolean;
  sessions: SessionSummary[];
  chapters: Chapter[];
  promotions: BeltHistoryEntry[];
}): string {
  const { year, isCurrentYear, sessions, chapters, promotions } = opts;
  if (sessions.length === 0) {
    return isCurrentYear ? 'Nothing on the mat yet this year.' : `No sessions recorded in ${year}.`;
  }
  const parts: string[] = [];
  const n = sessions.length;
  const hours = Math.round(totalMinutes(sessions) / 60);
  const hoursText = hours < 1 ? 'under an hour' : `${numberWords(hours)} ${plural(hours, 'hour')}`;
  parts.push(`${capitalise(numberWords(n))} ${plural(n, 'session')}, ${hoursText} on the mat.`);

  const counts: Record<string, number> = {};
  for (const s of sessions) {
    const tag = s.tags?.[0];
    if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const mostly = top ? `mostly ${(pillarLabel(top[0]) ?? top[0]).toLowerCase()}` : null;
  const k = chapters.filter(c => c.kind === 'intention').length;
  if (k > 0) parts.push(`${capitalise(numberWords(k))} ${plural(k, 'chapter')}${mostly ? `, ${mostly}` : ''}.`);
  else if (mostly) parts.push(`${capitalise(mostly)}.`);

  for (const p of [...promotions].sort((a, b) => a.promoted_at.localeCompare(b.promoted_at))) {
    const month = MONTH_FULL[Number(p.promoted_at.slice(5, 7)) - 1];
    parts.push(`${promotionText(p)} in ${month}.`);
  }
  return parts.join(' ');
}
