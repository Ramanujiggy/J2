import { describe, it, expect } from 'vitest';
import { deriveKernel } from '../composerKernel.ts';
import type { ClassSchedule } from '../../types/api.ts';

const sched = (over: Partial<ClassSchedule>): ClassSchedule => ({
  id: 'abc', name: 'No-Gi Fundamentals', day_of_week: 2, start_time: '19:00',
  duration_min: 90, gi_nogi: 'no_gi', created_at: '', ...over,
} as ClassSchedule);

// Tuesday 2026-06-30 21:00 local — class ended at 20:30.
const TUE_9PM = new Date(2026, 5, 30, 21, 0, 0);

describe('deriveKernel', () => {
  it('matches the most recently ended class today and inherits its fields', () => {
    const k = deriveKernel([sched({})], TUE_9PM);
    expect(k).toEqual({
      date: '2026-06-30', duration: 90, gi_nogi: 'no_gi', session_type: 'class',
      scheduleId: 'abc', scheduleName: 'No-Gi Fundamentals', startTime: '19:00',
    });
  });

  it('falls back to defaults when no schedule matches today', () => {
    const k = deriveKernel([sched({ day_of_week: 5 })], TUE_9PM);
    expect(k).toEqual({
      date: '2026-06-30', duration: 60, gi_nogi: 'gi', session_type: 'class',
      scheduleId: null, scheduleName: null, startTime: null,
    });
  });

  it('prefers an in-window class over an ended one', () => {
    const ended  = sched({ id: 'e', name: 'Lunch', start_time: '12:00' });
    const inWin  = sched({ id: 'w', name: 'Evening', start_time: '20:30', duration_min: 60 });
    const k = deriveKernel([ended, inWin], TUE_9PM);
    expect(k.scheduleId).toBe('w');
  });

  it('prefers most-recently-ended over upcoming when nothing is in-window', () => {
    const ended    = sched({ id: 'e', start_time: '18:00', duration_min: 60 }); // ended 19:00
    const upcoming = sched({ id: 'u', start_time: '22:00' });
    const k = deriveKernel([ended, upcoming], TUE_9PM);
    expect(k.scheduleId).toBe('e');
  });

  it('null schedule gi_nogi falls back to gi', () => {
    const k = deriveKernel([sched({ gi_nogi: null as unknown as 'gi' })], TUE_9PM);
    expect(k.gi_nogi).toBe('gi');
  });
});
