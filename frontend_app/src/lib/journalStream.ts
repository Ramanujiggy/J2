// journalStream — the corpus as one chronological list.
//
// Journal used to be an index of logged sessions. It is now the whole
// record: sessions, freeform notes, the intentions you declared, and the
// belts you tied on, interleaved newest-first and told apart by a small
// type label. Filter chips narrow it in place; they never split the page
// into silos, because the point of one stream is that everything you wrote
// sits in the same river.
//
// There is deliberately NO Intentions chip. Intentions are structure, not a
// content type — their copper rows in the stream are the affordance.
//
// Promotions are derived from belt_history rather than stored as entries.
// That keeps one source of truth for the belt, and it means a promotion
// becomes part of the corpus (and resurfaces on its anniversary) without a
// migration that duplicates rows the belt already owns.
//
// The merge happens on the client because all four sources are already
// fetched for other surfaces; a /api/stream endpoint would add a round trip
// to save work nobody is doing.

import type {
  BeltHistoryEntry, Intention, SessionSummary, TrainingNote,
} from '../types/api.ts';

export type StreamKind = 'session' | 'note' | 'intention' | 'promotion';

/** Chips filter the stream in place. Intentions and promotions are
 *  structure, so they ride along under `all` and are never chip-isolated. */
export type StreamChip = 'All' | 'Sessions' | 'Notes';

export interface StreamItem {
  id: string;
  kind: StreamKind;
  /** YYYY-MM-DD. Sort key and the date column. */
  dateKey: string;
  /** What the row reads as — the user's own words wherever there are any. */
  text: string;
  /** Whether `text` was cut short; the row trails off with an ellipsis. */
  truncated: boolean;
  /** Right-aligned quiet meta, one line per entry ("Gi class", "1 h"). */
  meta: string[];
  /** Active intention this item touches — appended to the type label. */
  intentionLabel?: string;
  /** Where the row navigates. Null rows are inert (nothing to open yet). */
  href: string | null;
  /** Present on session rows, so callers can open the detail modal. */
  session?: SessionSummary;
  /** Present on promotion rows, so callers can open the promotion entry. */
  promotion?: BeltHistoryEntry;
}

const EXCERPT_MAX = 150;

/** Trim to a word boundary; returns the text and whether it was cut. */
function excerpt(raw: string, maxChars = EXCERPT_MAX): { text: string; truncated: boolean } {
  const flat = raw.trim().replace(/\s+/g, ' ');
  if (flat.length <= maxChars) return { text: flat, truncated: false };
  const cut = flat.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const text = (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return { text, truncated: true };
}

function dateKeyOf(value: string): string {
  return value.slice(0, 10);
}

const HOUR_FMT = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} m`;
  if (h) return `${h} h`;
  return `${m} m`;
};

const GI_LABEL: Record<string, string> = {
  gi: 'Gi', no_gi: 'No-gi', both: 'Gi & no-gi',
};

const TYPE_LABEL_BASE: Record<StreamKind, string> = {
  session: 'Session',
  note: 'Note',
  intention: 'Intention · set',
  promotion: 'Promotion',
};

/** The row's type label, with the intention it touches appended. */
export function typeLabel(item: StreamItem): string {
  const base = TYPE_LABEL_BASE[item.kind];
  return item.intentionLabel ? `${base} · ${item.intentionLabel}` : base;
}

export function beltName(rank: string, stripes: number): string {
  const ordinals = ['first', 'second', 'third', 'fourth'];
  const belt = `${rank[0]?.toUpperCase() ?? ''}${rank.slice(1)} belt`;
  return stripes > 0 ? `${belt}, ${ordinals[stripes - 1]} stripe` : belt;
}

interface BuildInput {
  sessions: SessionSummary[];
  notes: TrainingNote[];
  intentions: Intention[];
  promotions: BeltHistoryEntry[];
  /** Sessions inside this intention's window get its name on their label. */
  activeIntention: Intention | null;
  /** Gym name for the promotion row's sentence, when we know it. */
  academy?: string | null;
}

/**
 * One list, newest first. Sessions with nothing written still get a row —
 * without them the stream silently drops training days and stops being a
 * truthful record.
 */
export function buildStream({
  sessions, notes, intentions, promotions, activeIntention, academy,
}: BuildInput): StreamItem[] {
  const items: StreamItem[] = [];

  const intentionStart = activeIntention ? activeIntention.week_start.slice(0, 10) : null;

  // Promotions linked to a class (mig 039), so that class's row can say so.
  const promotionBySession = new Map<string, BeltHistoryEntry>();
  for (const p of promotions) if (p.session_id) promotionBySession.set(p.session_id, p);

  for (const s of sessions) {
    const dateKey = dateKeyOf(typeof s.date === 'string' ? s.date : String(s.date));
    const written = s.notes?.trim();
    const { text, truncated } = written
      ? excerpt(written)
      : { text: 'Logged, but nothing written yet.', truncated: false };
    const linked = promotionBySession.get(s.id);
    const meta = [
      [GI_LABEL[s.gi_nogi] ?? '', s.session_type === 'drilling' ? 'drilling' : 'class']
        .filter(Boolean).join(' '),
      HOUR_FMT(s.duration),
      linked ? `${beltName(linked.belt_rank, linked.stripes)}, tied on` : '',
    ].filter(Boolean);
    items.push({
      id: `session-${s.id}`,
      kind: 'session',
      dateKey,
      text,
      truncated,
      meta,
      intentionLabel:
        activeIntention && intentionStart && dateKey >= intentionStart
          ? activeIntention.intent_label
          : undefined,
      href: `/journal/${s.id}`,
      session: s,
    });
  }

  for (const n of notes) {
    const { text, truncated } = excerpt(n.text);
    items.push({
      id: `note-${n.id}`,
      kind: 'note',
      dateKey: dateKeyOf(n.created_at),
      text,
      truncated,
      meta: [],
      href: '/notes',
    });
  }

  for (const i of intentions) {
    items.push({
      id: `intention-${i.id}`,
      kind: 'intention',
      dateKey: dateKeyOf(i.week_start),
      text: i.intent_label,
      truncated: false,
      meta: ['Declared'],
      href: `/intentions/${i.id}/journal`,
    });
  }

  // A promotion is a journal entry in its own right: its own words, written
  // in PromotionEntrySheet. Rows carry `promotion` so the page can open that
  // sheet — a promotion with no words yet still opens it, to write them.
  for (const p of promotions) {
    const name = beltName(p.belt_rank, p.stripes);
    const written = p.notes?.trim();
    const { text, truncated } = written
      ? excerpt(written)
      : {
          text: academy
            ? `The ${name.toLowerCase()}. Tied on at ${academy}.`
            : `The ${name.toLowerCase()}. Tied on.`,
          truncated: false,
        };
    items.push({
      id: `promotion-${p.id}`,
      kind: 'promotion',
      dateKey: dateKeyOf(p.promoted_at),
      text,
      truncated,
      meta: [written ? 'Recorded' : 'Write about it'],
      href: null,
      promotion: p,
    });
  }

  // Newest first. Ties break by kind so a promotion and the session logged
  // the same day read in a stable order rather than shuffling per fetch.
  const KIND_ORDER: Record<StreamKind, number> = {
    promotion: 0, intention: 1, session: 2, note: 3,
  };
  return items.sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  );
}

/** Chip + free-text narrowing. Search runs against the user's own words. */
export function filterStream(
  items: StreamItem[],
  chip: StreamChip,
  query: string,
): StreamItem[] {
  const q = query.trim().toLowerCase();
  return items.filter(item => {
    if (chip === 'Sessions' && item.kind !== 'session') return false;
    if (chip === 'Notes'    && item.kind !== 'note')    return false;
    if (q && !item.text.toLowerCase().includes(q)) return false;
    return true;
  });
}

export interface MonthGroup { month: string; key: string; items: StreamItem[] }

/** Month dividers, in stream order. */
export function groupByMonth(items: StreamItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const key = item.dateKey.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    const d = new Date(item.dateKey + 'T00:00:00');
    groups.push({
      key,
      month: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d),
      items: [item],
    });
  }
  return groups;
}

export interface YearBlock {
  year: string;
  /** "Jan – Jul" for a partial year, "Full year" otherwise. */
  range: string;
  /** 24 density ticks, 0–1. Drawn from entry counts, never hours. */
  ticks: number[];
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The year scrubber. One block per year present in the stream, newest
 * first, with a 24-bucket density strip (roughly half-months) so an
 * imported year and a lived-in one sit in the same shape.
 */
export function yearBlocks(items: StreamItem[]): YearBlock[] {
  const byYear = new Map<string, StreamItem[]>();
  for (const item of items) {
    const y = item.dateKey.slice(0, 4);
    const list = byYear.get(y);
    if (list) list.push(item);
    else byYear.set(y, [item]);
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, yearItems]) => {
      const buckets = new Array(24).fill(0);
      let minMonth = 11, maxMonth = 0;
      for (const item of yearItems) {
        const month = Number(item.dateKey.slice(5, 7)) - 1;
        const day = Number(item.dateKey.slice(8, 10));
        const idx = Math.min(23, month * 2 + (day > 15 ? 1 : 0));
        buckets[idx] += 1;
        if (month < minMonth) minMonth = month;
        if (month > maxMonth) maxMonth = month;
      }
      const peak = Math.max(...buckets, 1);
      const full = minMonth === 0 && maxMonth === 11;
      return {
        year,
        range: full ? 'Full year' : `${MONTH_ABBR[minMonth]} – ${MONTH_ABBR[maxMonth]}`,
        ticks: buckets.map(n => n / peak),
      };
    });
}
