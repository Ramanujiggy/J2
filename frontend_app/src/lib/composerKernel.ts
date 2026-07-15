// Kernel derivation for the Capture Composer — "the app never asks what it
// already knows." Given the user's class schedules and the current time,
// produce the structured fields a session row needs, so the composer can
// render them as a quiet caption instead of form inputs. Spec §3.
//
// Match priority mirrors useTodayClass's picker, biased for capture: a class
// you're IN beats one that ended; most-recently-ended beats upcoming (the
// drive-home moment writes about the class that just finished).

import type { ClassSchedule } from '../types/api.ts';
import { toDateString } from './sessionUtils.ts';

export interface Kernel {
  date: string;                                   // YYYY-MM-DD
  duration: number;                              // minutes
  gi_nogi: 'gi' | 'no_gi' | 'both';
  session_type: 'class' | 'drilling' | 'competition_training' | 'cla';
  scheduleId: string | null;
  scheduleName: string | null;
  startTime: string | null;                      // "HH:MM" from the schedule
}

const DEFAULTS = { duration: 60, gi_nogi: 'gi' as const, session_type: 'class' as const };

export function deriveKernel(schedules: ClassSchedule[], now: Date): Kernel {
  const date = toDateString(now);
  const dow = now.getDay();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const nowMs = now.getTime();

  const resolved = schedules
    .filter(s => s.day_of_week === dow)
    .flatMap(s => {
      const [hh, mm] = s.start_time.split(':').map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return [];
      const startMs = dayStart + (hh * 60 + mm) * 60_000;
      return [{ s, startMs, endMs: startMs + s.duration_min * 60_000 }];
    });

  const inWindow = resolved.find(r => r.startMs <= nowMs && nowMs < r.endMs);
  const ended    = resolved.filter(r => r.endMs <= nowMs).sort((a, b) => b.endMs - a.endMs)[0];
  const upcoming = resolved.filter(r => r.startMs > nowMs).sort((a, b) => a.startMs - b.startMs)[0];
  const pick = inWindow ?? ended ?? upcoming;

  if (!pick) {
    return { date, ...DEFAULTS, scheduleId: null, scheduleName: null, startTime: null };
  }
  return {
    date,
    duration: pick.s.duration_min,
    gi_nogi: pick.s.gi_nogi ?? 'gi',
    session_type: 'class',
    scheduleId: pick.s.id,
    scheduleName: pick.s.name,
    startTime: pick.s.start_time,
  };
}
