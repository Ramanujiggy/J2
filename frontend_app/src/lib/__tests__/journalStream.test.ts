import { describe, it, expect } from 'vitest';
import {
  buildStream, filterStream, groupByMonth, yearBlocks, typeLabel, beltName,
} from '../journalStream.ts';
import type { StreamItem } from '../journalStream.ts';
import type {
  BeltHistoryEntry, Intention, SessionSummary, TrainingNote,
} from '../../types/api.ts';

const session = (over: Partial<SessionSummary> & { id: string; date: string }): SessionSummary => ({
  duration: 60,
  gi_nogi: 'gi',
  session_type: 'class',
  intensity: 3,
  ...over,
} as SessionSummary);

const note = (id: string, created_at: string, text: string): TrainingNote => ({
  id, text, tags: [], linked_session_id: null, linked_tag_ids: [],
  pinned: false, created_at, updated_at: created_at,
});

const intention = (id: string, week_start: string, intent_label: string): Intention => ({
  id, user_id: 'u', week_start, intent_label,
  intent_category: null, heading: null, duration_days: 35,
  completion_type: 'days', target_count: null,
} as Intention);

const promotion = (id: string, promoted_at: string, over: Partial<BeltHistoryEntry> = {}): BeltHistoryEntry => ({
  id, belt_rank: 'black', stripes: 0, promoted_at, notes: null, ...over,
});

const EMPTY = { sessions: [], notes: [], intentions: [], promotions: [], activeIntention: null };

describe('buildStream', () => {
  it('interleaves all four kinds newest-first', () => {
    const items = buildStream({
      ...EMPTY,
      sessions:   [session({ id: 's1', date: '2026-07-20', notes: 'Flat day.' })],
      notes:      [note('n1', '2026-07-19T10:00:00Z', 'Watched the Rafa study.')],
      intentions: [intention('i1', '2026-06-18', 'Stop conceding the underhook')],
      promotions: [promotion('p1', '2026-07-25')],
    });

    expect(items.map(i => i.kind)).toEqual(['promotion', 'session', 'note', 'intention']);
    expect(items.map(i => i.dateKey)).toEqual(['2026-07-25', '2026-07-20', '2026-07-19', '2026-06-18']);
  });

  it('keeps sessions with nothing written — dropping them would lie about the week', () => {
    const items = buildStream({ ...EMPTY, sessions: [session({ id: 's1', date: '2026-07-20' })] });
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe('Logged, but nothing written yet.');
  });

  it('truncates a long entry on a word boundary and flags it', () => {
    const long = 'word '.repeat(60).trim();
    const items = buildStream({ ...EMPTY, sessions: [session({ id: 's1', date: '2026-07-20', notes: long })] });
    expect(items[0]!.truncated).toBe(true);
    expect(items[0]!.text.endsWith('word')).toBe(true);
    expect(items[0]!.text.length).toBeLessThanOrEqual(150);
  });

  it('labels sessions on or after the active intention start, and not before', () => {
    const active = intention('i1', '2026-07-01', 'Stop conceding the underhook');
    const items = buildStream({
      ...EMPTY,
      sessions: [
        session({ id: 'after',  date: '2026-07-10', notes: 'a' }),
        session({ id: 'before', date: '2026-06-10', notes: 'b' }),
      ],
      activeIntention: active,
    });
    const after  = items.find(i => i.id === 'session-after')!;
    const before = items.find(i => i.id === 'session-before')!;
    expect(typeLabel(after)).toBe('Session · Stop conceding the underhook');
    expect(typeLabel(before)).toBe('Session');
  });

  it('writes a promotion sentence when the belt has no note, and uses the note when it does', () => {
    const [bare] = buildStream({ ...EMPTY, promotions: [promotion('p1', '2026-07-25')], academy: 'Academy of Combat Arts' });
    expect(bare!.text).toBe('The black belt. Tied on at Academy of Combat Arts.');

    const [written] = buildStream({
      ...EMPTY,
      promotions: [promotion('p2', '2026-07-25', { notes: 'Marco tied it on.' })],
    });
    expect(written!.text).toBe('Marco tied it on.');
  });

  it('promotion rows carry the promotion so the page can open its entry', () => {
    const [bare] = buildStream({ ...EMPTY, promotions: [promotion('p1', '2026-07-25')] });
    expect(bare!.promotion?.id).toBe('p1');
    expect(bare!.href).toBeNull();
    expect(bare!.meta).toEqual(['Write about it']);

    const [written] = buildStream({
      ...EMPTY,
      promotions: [promotion('p2', '2026-07-25', { notes: 'Marco tied it on.' })],
    });
    expect(written!.meta).toEqual(['Recorded']);
  });

  it("a class linked to a promotion names the belt in its meta; others don't", () => {
    const items = buildStream({
      ...EMPTY,
      sessions: [
        session({ id: 's1', date: '2026-07-25', notes: 'x' }),
        session({ id: 's2', date: '2026-07-24', notes: 'y' }),
      ],
      promotions: [promotion('p1', '2026-07-25', { stripes: 1, session_id: 's1' })],
    });
    const linked = items.find(i => i.id === 'session-s1')!;
    const other  = items.find(i => i.id === 'session-s2')!;
    expect(linked.meta.at(-1)).toBe('Black belt, first stripe, tied on');
    expect(other.meta.some(m => m.includes('tied on'))).toBe(false);
  });

  it('orders same-day items by kind so the list does not shuffle between fetches', () => {
    const items = buildStream({
      ...EMPTY,
      sessions:   [session({ id: 's1', date: '2026-07-25', notes: 'x' })],
      promotions: [promotion('p1', '2026-07-25')],
    });
    expect(items.map(i => i.kind)).toEqual(['promotion', 'session']);
  });
});

describe('beltName', () => {
  it('names the rank and the stripe', () => {
    expect(beltName('black', 0)).toBe('Black belt');
    expect(beltName('purple', 2)).toBe('Purple belt, second stripe');
  });
});

describe('filterStream', () => {
  const items = buildStream({
    ...EMPTY,
    sessions:   [session({ id: 's1', date: '2026-07-20', notes: 'Koichi to the back again' })],
    notes:      [note('n1', '2026-07-19T10:00:00Z', 'Knee-cut detail')],
    intentions: [intention('i1', '2026-06-18', 'Stop conceding the underhook')],
    promotions: [promotion('p1', '2026-07-25')],
  });

  it('All keeps every kind — intentions and promotions are structure, not a chip', () => {
    expect(filterStream(items, 'All', '')).toHaveLength(4);
  });

  it('Sessions and Notes isolate their own kind', () => {
    expect(filterStream(items, 'Sessions', '').map(i => i.kind)).toEqual(['session']);
    expect(filterStream(items, 'Notes', '').map(i => i.kind)).toEqual(['note']);
  });

  it('searches the users own words, case-insensitively', () => {
    expect(filterStream(items, 'All', 'koichi').map(i => i.id)).toEqual(['session-s1']);
    expect(filterStream(items, 'All', 'nothing here')).toHaveLength(0);
  });
});

describe('groupByMonth', () => {
  it('opens a new group per calendar month, in stream order', () => {
    const items = buildStream({
      ...EMPTY,
      sessions: [
        session({ id: 'a', date: '2026-07-20', notes: 'a' }),
        session({ id: 'b', date: '2026-07-02', notes: 'b' }),
        session({ id: 'c', date: '2026-06-29', notes: 'c' }),
      ],
    });
    const groups = groupByMonth(items);
    expect(groups.map(g => g.month)).toEqual(['July 2026', 'June 2026']);
    expect(groups[0]!.items).toHaveLength(2);
  });

  it('returns nothing for an empty stream', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('yearBlocks', () => {
  it('builds one block per year, newest first, with 24 normalised ticks', () => {
    const items = buildStream({
      ...EMPTY,
      sessions: [
        session({ id: 'a', date: '2026-01-05', notes: 'a' }),
        session({ id: 'b', date: '2026-01-06', notes: 'b' }),
        session({ id: 'c', date: '2025-03-20', notes: 'c' }),
      ],
    });
    const blocks = yearBlocks(items);
    expect(blocks.map(b => b.year)).toEqual(['2026', '2025']);
    expect(blocks[0]!.ticks).toHaveLength(24);
    // Two entries in the first half of January is the year's peak.
    expect(Math.max(...blocks[0]!.ticks)).toBe(1);
    expect(blocks[0]!.ticks[0]).toBe(1);
  });

  it('calls a year spanning January to December a full year', () => {
    const items: StreamItem[] = buildStream({
      ...EMPTY,
      sessions: [
        session({ id: 'a', date: '2025-01-05', notes: 'a' }),
        session({ id: 'b', date: '2025-12-20', notes: 'b' }),
      ],
    });
    expect(yearBlocks(items)[0]!.range).toBe('Full year');
  });

  it('names the observed span for a partial year', () => {
    const items = buildStream({
      ...EMPTY,
      sessions: [
        session({ id: 'a', date: '2026-01-05', notes: 'a' }),
        session({ id: 'b', date: '2026-07-20', notes: 'b' }),
      ],
    });
    expect(yearBlocks(items)[0]!.range).toBe('Jan – Jul');
  });
});
