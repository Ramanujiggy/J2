import { describe, it, expect } from 'vitest';
import {
  buildChapters, buildShelf, excerpt, intentionEnd, numberWords, weekOfChapter, yearSentence,
} from '../calendarBook';
import type { Intention, SessionSummary, BeltHistoryEntry } from '@/types/api';

const session = (id: string, date: string, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id, date, duration: 60, intensity: 3, gi_nogi: 'gi', session_type: 'class', tags: ['guard'], ...extra,
});

const intention = (id: string, start: string, days: number, extra: Partial<Intention> = {}): Intention => ({
  id, user_id: 'u', week_start: start, intent_label: `Intention ${id}`, intent_category: null, heading: 'guard',
  duration_days: days, completion_type: 'days', target_count: null, journal_entry: null, created_at: start, ...extra,
});

describe('buildChapters', () => {
  const sessions = [
    session('a', '2026-01-05'),
    session('b', '2026-02-10'),
    session('c', '2026-02-20'),
    session('d', '2026-03-03'),
    session('e', '2026-03-20'),
  ];

  it('makes one chapter per intention and one for each stretch between them', () => {
    const chapters = buildChapters(sessions, [intention('i1', '2026-02-09', 21)], 2026, '2026-10-21');
    expect(chapters.map(c => c.key)).toEqual(['between-2026-01-01', 'i1', 'between-2026-03-02']);
    expect(chapters[0]).toMatchObject({ kind: 'between', title: 'January – February', end: '2026-02-08' });
    const i1 = chapters.find(c => c.key === 'i1')!;
    expect(i1.end).toBe('2026-03-01');
    expect(i1.sessions.map(s => s.id)).toEqual(['b', 'c']);
    expect(i1.number).toBe(1);
    // The stretch after it holds only the sessions outside the intention
    expect(chapters.find(c => c.key === 'between-2026-03-02')!.sessions.map(s => s.id)).toEqual(['d', 'e']);
  });

  it('falls back to months when the year has no intentions', () => {
    const chapters = buildChapters(sessions, [], 2026, '2026-10-21');
    expect(chapters.map(c => c.title)).toEqual(['January', 'February', 'March']);
  });

  it('cuts an intention short when the next one starts', () => {
    const chapters = buildChapters(sessions, [
      intention('i1', '2026-02-09', 60),
      intention('i2', '2026-03-02', 14),
    ], 2026, '2026-10-21');
    expect(chapters.find(c => c.key === 'i1')!.end).toBe('2026-03-01');
    expect(chapters.find(c => c.key === 'i2')!.sessions.map(s => s.id)).toEqual(['d']);
  });

  it('marks the chapter holding today as ongoing', () => {
    const chapters = buildChapters([session('x', '2026-10-06')], [intention('now', '2026-10-05', 28)], 2026, '2026-10-21');
    expect(chapters[0]!.ongoing).toBe(true);
    expect(weekOfChapter(chapters[0]!, '2026-10-21')).toBe(3);
  });
});

describe('intentionEnd', () => {
  it('ends a session-count intention on the session that meets it', () => {
    const i = intention('s', '2026-04-01', 60, { completion_type: 'sessions', target_count: 2 });
    const sorted = [session('a', '2026-04-03'), session('b', '2026-04-08'), session('c', '2026-04-15')];
    expect(intentionEnd(i, sorted)).toBe('2026-04-08');
  });

  it('only counts sessions touching the heading', () => {
    const i = intention('s', '2026-04-01', 60, { completion_type: 'sessions', target_count: 2 });
    const sorted = [session('a', '2026-04-03'), session('b', '2026-04-08', { tags: ['passing'] }), session('c', '2026-04-15')];
    expect(intentionEnd(i, sorted)).toBe('2026-04-15');
  });
});

describe('buildShelf', () => {
  it('puts every week of the year on a month book and sums its minutes', () => {
    const books = buildShelf([session('a', '2026-01-01', { duration: 90 }), session('b', '2026-01-02', { intensity: 5 })], 2026, '2026-10-21');
    expect(books).toHaveLength(12);
    const weeks = books.flatMap(b => b.weeks);
    expect(weeks.length).toBeGreaterThanOrEqual(52);
    // Jan 1 2026 is a Thursday; its week starts Mon Dec 29 and belongs to January
    expect(books[0]!.weeks[0]).toMatchObject({ start: '2025-12-29', minutes: 150, hard: true });
    expect(weeks.find(w => w.isNow)!.start).toBe('2026-10-19');
  });
});

describe('yearSentence', () => {
  const promo: BeltHistoryEntry = { id: 'p', belt_rank: 'purple', stripes: 0, promoted_at: '2026-09-14', notes: null };

  it('tells the year back in words', () => {
    const sessions = Array.from({ length: 76 }, (_, i) => session(String(i), '2026-05-01', { duration: 64 }));
    const chapters = buildChapters(sessions, [intention('i', '2026-04-27', 14)], 2026, '2026-10-21');
    expect(yearSentence({ year: 2026, isCurrentYear: true, sessions, chapters, promotions: [promo] }))
      .toBe('Seventy-six sessions, eighty-one hours on the mat. One chapter, mostly guard. Purple belt in September.');
  });

  it('is quiet about an empty year', () => {
    expect(yearSentence({ year: 2024, isCurrentYear: false, sessions: [], chapters: [], promotions: [] }))
      .toBe('No sessions recorded in 2024.');
  });
});

describe('text helpers', () => {
  it('writes small numbers as words', () => {
    expect(numberWords(0)).toBe('zero');
    expect(numberWords(42)).toBe('forty-two');
    expect(numberWords(140)).toBe('140');
  });

  it('cuts an excerpt at a word', () => {
    expect(excerpt('Frames first, then the knee comes back in on its own.', 30)).toBe('Frames first, then the knee…');
  });
});
