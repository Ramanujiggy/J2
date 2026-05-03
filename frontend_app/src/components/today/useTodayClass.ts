// useTodayClass — fetches the user's class schedule, picks today's class
// (if any), and derives the time-aware state used by <TodayCard>:
//
//   pre_class           class scheduled today, now < start
//   in_class            now is within [start, start + duration)
//   post_class_unlogged class ended, no logged session covers its window
//   logged              a session was logged within the class window
//   no_class_today      no class scheduled for today's day_of_week
//
// Logged-state detection is heuristic: any session today whose date matches
// the local day counts as "logged for today's class" — we don't try to
// match by start_time since session times aren't stored. This is right for
// 99% of real cases (one or zero classes per day on the schedule).

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { ClassSchedule, ClassSchedulesResponse, SessionSummary } from '../../types/api.ts';

export type TodayState =
  | 'pre_class'
  | 'in_class'
  | 'post_class_unlogged'
  | 'logged'
  | 'no_class_today';

export interface TodayInfo {
  state: TodayState;
  schedule: ClassSchedule | null;
  /** Minutes from now until class start. Negative = after start. */
  minutesUntilStart: number | null;
  /** Minutes from now since class end. Negative = class hasn't ended. */
  minutesSinceEnd: number | null;
  /** True while the schedules fetch is in flight. */
  loading: boolean;
}

function parseStartTime(s: string): { h: number; m: number } | null {
  const [hh, mm] = s.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return { h: hh, m: mm };
}

export function useTodayClass(sessions: SessionSummary[]): TodayInfo {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get<ClassSchedulesResponse>('/api/class-schedules')
      .then(res => { if (alive) setSchedules(res.schedules ?? []); })
      .catch(() => { /* class times are optional — silently degrade to no_class_today */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return useMemo<TodayInfo>(() => {
    const now = new Date();
    const todayDow = now.getDay(); // 0=Sun … 6=Sat (matches users.day_of_week)
    const todaysClasses = schedules.filter(s => s.day_of_week === todayDow);

    if (todaysClasses.length === 0) {
      return { state: 'no_class_today', schedule: null, minutesUntilStart: null, minutesSinceEnd: null, loading };
    }

    // If multiple classes today (rare), pick the one whose window contains
    // `now`, else the next-upcoming, else the most recently ended.
    type Resolved = {
      schedule: ClassSchedule;
      startMs: number;
      endMs: number;
      minutesUntilStart: number;
      minutesSinceEnd: number;
    };
    const nowMs = now.getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const resolved: Resolved[] = todaysClasses.flatMap((s) => {
      const t = parseStartTime(s.start_time);
      if (!t) return [];
      const startMs = todayStart + (t.h * 60 + t.m) * 60_000;
      const endMs = startMs + s.duration_min * 60_000;
      return [{
        schedule: s,
        startMs,
        endMs,
        minutesUntilStart: Math.round((startMs - nowMs) / 60_000),
        minutesSinceEnd:   Math.round((nowMs - endMs) / 60_000),
      }];
    });

    if (resolved.length === 0) {
      return { state: 'no_class_today', schedule: null, minutesUntilStart: null, minutesSinceEnd: null, loading };
    }

    // Prefer in-window > next upcoming > most recently ended
    const inWindow  = resolved.find(r => r.startMs <= nowMs && nowMs < r.endMs);
    const upcoming  = resolved.filter(r => r.startMs > nowMs).sort((a, b) => a.startMs - b.startMs)[0];
    const ended     = resolved.filter(r => r.endMs <= nowMs).sort((a, b) => b.endMs - a.endMs)[0];
    const pick      = inWindow ?? upcoming ?? ended!;

    // Determine if a session has been logged for today already (heuristic — see file header).
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const loggedToday = sessions.some(s => {
      const dateStr = typeof s.date === 'string' ? s.date.slice(0, 10) : '';
      return dateStr === todayKey;
    });

    let state: TodayState;
    if (pick === inWindow) {
      state = 'in_class';
    } else if (pick === upcoming) {
      state = 'pre_class';
    } else {
      // Class ended → either logged or pending.
      state = loggedToday ? 'logged' : 'post_class_unlogged';
    }

    return {
      state,
      schedule: pick.schedule,
      minutesUntilStart: pick.minutesUntilStart,
      minutesSinceEnd: pick.minutesSinceEnd,
      loading,
    };
  }, [schedules, sessions, loading]);
}

/** Format a minute count as "in 2h 14m" / "in 45m" / "ended 2h ago". */
export function formatRelativeMinutes(minutes: number, suffix: 'until' | 'since'): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const compact = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return suffix === 'until' ? `in ${compact}` : `${compact} ago`;
}
