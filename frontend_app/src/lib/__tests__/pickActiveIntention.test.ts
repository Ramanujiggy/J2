import { describe, it, expect } from 'vitest';
import { pickActiveIntention } from '../analyticsUtils.ts';
import type { Intention, SessionSummary } from '../../types/api.ts';

const TODAY = '2026-07-25';

function intention(over: Partial<Intention> & { id: string; week_start: string }): Intention {
  return {
    user_id: 'u1',
    intent_label: 'Guard retention',
    intent_category: null,
    heading: 'guard',
    duration_days: 7,
    completion_type: 'days',
    target_count: null,
    journal_entry: null,
    created_at: over.week_start,
    ...over,
  };
}

function session(id: string, date: string): SessionSummary {
  return { id, date, duration: 60, intensity: 3, gi_nogi: 'gi', session_type: 'class', tags: ['guard'] };
}

describe('pickActiveIntention', () => {
  it('returns the intention whose window covers today', () => {
    const past = intention({ id: 'past', week_start: '2026-07-01' });
    const now = intention({ id: 'now', week_start: '2026-07-21' });
    expect(pickActiveIntention([past, now], TODAY)?.id).toBe('now');
  });

  it('returns null when no window covers today', () => {
    expect(pickActiveIntention([intention({ id: 'a', week_start: '2026-07-01' })], TODAY)).toBeNull();
  });

  it('prefers the most recently started when windows overlap, regardless of order', () => {
    const long = intention({ id: 'long', week_start: '2026-07-01', duration_days: 60 });
    const recent = intention({ id: 'recent', week_start: '2026-07-22' });
    expect(pickActiveIntention([long, recent], TODAY)?.id).toBe('recent');
    expect(pickActiveIntention([recent, long], TODAY)?.id).toBe('recent');
  });

  it('drops a sessions-mode intention once its target is met, when sessions are given', () => {
    const done = intention({
      id: 'done', week_start: '2026-07-20', duration_days: 30,
      completion_type: 'sessions', target_count: 2,
    });
    const sessions = [session('s1', '2026-07-21'), session('s2', '2026-07-23')];
    expect(pickActiveIntention([done], TODAY, sessions)).toBeNull();
    expect(pickActiveIntention([done], TODAY)?.id).toBe('done');
  });

  it('falls back to an older covering intention when the newer one is complete', () => {
    const older = intention({ id: 'older', week_start: '2026-07-10', duration_days: 30 });
    const done = intention({
      id: 'done', week_start: '2026-07-20', duration_days: 30,
      completion_type: 'sessions', target_count: 1,
    });
    expect(pickActiveIntention([done, older], TODAY, [session('s1', '2026-07-21')])?.id).toBe('older');
  });
});
