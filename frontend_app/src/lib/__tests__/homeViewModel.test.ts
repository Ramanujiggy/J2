import { describe, it, expect } from 'vitest';
import {
  findUnfinishedEntry,
  findMemoryEntry,
  buildRecentEntries,
  excerptOf,
  portraitDistributions,
} from '../homeViewModel.ts';
import type { SessionSummary } from '../../types/api.ts';

const TODAY = new Date(2026, 6, 25); // Sat 25 Jul 2026 — local time, like the app

function session(over: Partial<SessionSummary> & { id: string; date: string }): SessionSummary {
  return {
    duration: 60,
    intensity: 3,
    gi_nogi: 'gi',
    session_type: 'class',
    tags: [],
    ...over,
  };
}

describe('findUnfinishedEntry', () => {
  it('returns the most recent session with nothing written', () => {
    const found = findUnfinishedEntry([
      session({ id: 'old', date: '2026-07-20' }),
      session({ id: 'recent', date: '2026-07-24' }),
    ], TODAY);
    expect(found?.id).toBe('recent');
  });

  it('ignores sessions that already have writing', () => {
    const found = findUnfinishedEntry([
      session({ id: 'written', date: '2026-07-24', notes: 'Drilled the knee cut.' }),
      session({ id: 'blank',   date: '2026-07-22' }),
    ], TODAY);
    expect(found?.id).toBe('blank');
  });

  it('treats whitespace-only notes as unwritten', () => {
    const found = findUnfinishedEntry([
      session({ id: 'ws', date: '2026-07-24', notes: '   \n  ' }),
    ], TODAY);
    expect(found?.id).toBe('ws');
  });

  // An unwritten session from two months ago is history, not a task. Letting
  // it own the hero forever would turn the card into a nag.
  it('gives up once the newest unwritten session is older than a week', () => {
    expect(findUnfinishedEntry([
      session({ id: 'stale', date: '2026-06-01' }),
    ], TODAY)).toBeNull();
  });

  it('skips future-dated sessions rather than treating them as tasks', () => {
    const found = findUnfinishedEntry([
      session({ id: 'future', date: '2026-07-28' }),
      session({ id: 'today',  date: '2026-07-25' }),
    ], TODAY);
    expect(found?.id).toBe('today');
  });

  it('returns null when everything is written', () => {
    expect(findUnfinishedEntry([
      session({ id: 'a', date: '2026-07-24', notes: 'wrote something' }),
    ], TODAY)).toBeNull();
  });
});

describe('findMemoryEntry — the resurfacing chain', () => {
  it('prefers an entry from a year ago today', () => {
    const found = findMemoryEntry([
      session({ id: 'exact', date: '2025-07-25', notes: 'First triangle in live rolling.' }),
      session({ id: 'month', date: '2025-07-10', notes: 'Something else.' }),
    ], TODAY);
    expect(found?.tier).toBe('year_ago_today');
    expect(found?.session.id).toBe('exact');
    expect(found?.label).toBe('A year ago today');
  });

  it('falls back to the same month last year, closest day-of-month first', () => {
    const found = findMemoryEntry([
      session({ id: 'far',   date: '2025-07-02', notes: 'far from the 25th' }),
      session({ id: 'close', date: '2025-07-23', notes: 'close to the 25th' }),
    ], TODAY);
    expect(found?.tier).toBe('month_last_year');
    expect(found?.session.id).toBe('close');
    expect(found?.label).toBe('July last year');
  });

  it('falls back to the most-sealed entry when no anniversary exists', () => {
    const found = findMemoryEntry([
      session({ id: 'plain',  date: '2026-03-01', notes: 'a normal day' }),
      session({
        id: 'sealed', date: '2026-02-01', notes: 'the good one',
        stamps: [
          { die_key: 'boa', struck_at: '2026-02-01T18:00:00Z' },
          { die_key: 'boa', struck_at: '2026-02-01T19:00:00Z' },
        ],
      }),
    ], TODAY);
    expect(found?.tier).toBe('most_sealed');
    expect(found?.session.id).toBe('sealed');
  });

  // The memory exists to be read — an unwritten session has nothing to offer.
  it('never resurfaces an entry with no writing', () => {
    expect(findMemoryEntry([
      session({ id: 'blank', date: '2025-07-25' }),
    ], TODAY)).toBeNull();
  });

  it('counts the ordinal over all sessions, not just written ones', () => {
    const found = findMemoryEntry([
      session({ id: 'first',  date: '2025-07-01' }),
      session({ id: 'second', date: '2025-07-10' }),
      session({ id: 'third',  date: '2025-07-25', notes: 'the memory' }),
    ], TODAY);
    expect(found?.ordinal).toBe(3);
  });
});

describe('buildRecentEntries', () => {
  // Without unwritten rows the list silently drops training days and stops
  // being a truthful record of the week.
  it('includes sessions with no notes, with a null excerpt', () => {
    const rows = buildRecentEntries([
      session({ id: 'written', date: '2026-07-24', notes: 'Rolled with Ash.' }),
      session({ id: 'blank',   date: '2026-07-22' }),
    ]);
    expect(rows.map(r => r.session.id)).toEqual(['written', 'blank']);
    expect(rows[1]!.excerpt).toBeNull();
  });

  it('returns newest first and caps at three', () => {
    const rows = buildRecentEntries([
      session({ id: 'a', date: '2026-07-01' }),
      session({ id: 'b', date: '2026-07-20' }),
      session({ id: 'c', date: '2026-07-10' }),
      session({ id: 'd', date: '2026-07-24' }),
    ]);
    expect(rows.map(r => r.session.id)).toEqual(['d', 'b', 'c']);
  });
});

describe('excerptOf', () => {
  it('collapses newlines so the row stays two lines of prose', () => {
    expect(excerptOf(session({ id: 'x', date: '2026-07-01', notes: 'one\n\ntwo' })))
      .toBe('one two');
  });

  it('truncates on a word boundary', () => {
    const notes = 'The quick brown fox jumps over the lazy dog again and again';
    const out = excerptOf(session({ id: 'x', date: '2026-07-01', notes }), 20)!;
    expect(out.length).toBeLessThanOrEqual(20);
    expect(notes.startsWith(out)).toBe(true);
    expect(out.endsWith(' ')).toBe(false);
  });

  it('returns null for an unwritten session', () => {
    expect(excerptOf(session({ id: 'x', date: '2026-07-01' }))).toBeNull();
  });
});

describe('portraitDistributions', () => {
  it('skips sessions with no distribution', () => {
    const out = portraitDistributions([
      session({ id: 'a', date: '2026-07-01', pillar_distribution: { guard: 1 } }),
      session({ id: 'b', date: '2026-07-02' }),
      session({ id: 'c', date: '2026-07-03', pillar_distribution: {} }),
    ]);
    expect(out).toEqual([{ guard: 1 }]);
  });

  it('caps the layer count — past the cap the shape stops changing but the paint cost does not', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      session({ id: `s${i}`, date: '2026-07-01', pillar_distribution: { guard: 1 } }));
    expect(portraitDistributions(many)).toHaveLength(60);
    expect(portraitDistributions(many, 10)).toHaveLength(10);
  });
});
