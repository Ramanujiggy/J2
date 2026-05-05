// useTodayClass — the data brain behind <TodayCard>. Watches the user's
// class schedule, today's logged sessions, and two per-class user answers
// (planning + attendance) persisted in localStorage. Picks the most
// relevant class to surface and exposes a state-machine value the UI
// renders against.
//
// State machine (see TodayState):
//
//   pre_class_unanswered          class upcoming today; user hasn't said
//                                 yes/no on planning yet → ask "Planning
//                                 to attend?"
//   pre_class_planning            class upcoming; user said yes →
//                                 quiet "you're planning to attend"
//   in_class                      now is within [start, start+duration)
//   post_class_unanswered         class ended; user hasn't said yes/no on
//                                 attendance yet → ask "Did you attend?"
//   post_class_attended_unlogged  user said yes; no session logged yet →
//                                 hero "open log" CTA (drive-home moment)
//   logged                        user said yes AND a session is logged
//   no_class_today                no class on the schedule for today
//                                 (or every today's class was skipped via
//                                 a "no" answer)
//
// Persistence: localStorage, keyed by `(scheduleId, YYYY-MM-DD)`. Two
// independent flags per class:
//
//   attendance.{id}.{date}.planning   'yes' | 'no'   pre-class commitment
//   attendance.{id}.{date}.attended   'yes' | 'no'   post-class outcome
//
// "no" on either flag filters the class out of consideration — the hook
// then picks the next-most-relevant class today, or returns no_class_today.
//
// Exposed mutators (`setPlanning` / `setAttended`) write to localStorage
// AND bump an internal tick so the hook re-evaluates immediately.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.ts';
import type { ClassSchedule, ClassSchedulesResponse, SessionSummary } from '../../types/api.ts';

export type TodayState =
  | 'pre_class_unanswered'
  | 'pre_class_planning'
  | 'in_class'
  | 'post_class_unanswered'
  | 'post_class_attended_unlogged'
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
  /** Pre-class commit. Idempotent. Triggers re-evaluation. */
  setPlanning: (planning: 'yes' | 'no') => void;
  /** Post-class outcome. Idempotent. Triggers re-evaluation. */
  setAttended: (attended: 'yes' | 'no') => void;
}

function parseStartTime(s: string): { h: number; m: number } | null {
  const [hh, mm] = s.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return { h: hh, m: mm };
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Flag = 'planning' | 'attended';

function readFlag(scheduleId: string, date: string, flag: Flag): 'yes' | 'no' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`attendance.${scheduleId}.${date}.${flag}`);
    return raw === 'yes' || raw === 'no' ? raw : null;
  } catch {
    return null;
  }
}

function writeFlag(scheduleId: string, date: string, flag: Flag, value: 'yes' | 'no'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`attendance.${scheduleId}.${date}.${flag}`, value);
  } catch {
    // private mode / quota — silently degrade; the page will simply re-prompt
  }
}

export function useTodayClass(sessions: SessionSummary[]): TodayInfo {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  // Bumped whenever the user answers a prompt — forces the useMemo below to
  // re-read localStorage and recompute the state. (localStorage writes don't
  // trigger React re-renders on their own.)
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get<ClassSchedulesResponse>('/api/class-schedules')
      .then(res => { if (alive) setSchedules(res.schedules ?? []); })
      .catch(() => { /* class times are optional — silently degrade to no_class_today */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const date = todayKey();

  const info: Omit<TodayInfo, 'setPlanning' | 'setAttended'> = useMemo(() => {
    const now = new Date();
    const todayDow = now.getDay();
    const todaysClasses = schedules.filter(s => s.day_of_week === todayDow);

    if (todaysClasses.length === 0) {
      return { state: 'no_class_today', schedule: null, minutesUntilStart: null, minutesSinceEnd: null, loading };
    }

    type Resolved = {
      schedule: ClassSchedule;
      startMs: number;
      endMs: number;
      minutesUntilStart: number;
      minutesSinceEnd: number;
      planning: 'yes' | 'no' | null;
      attended: 'yes' | 'no' | null;
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
        planning: readFlag(s.id, date, 'planning'),
        attended: readFlag(s.id, date, 'attended'),
      }];
    });

    // Filter out classes the user opted out of (either planning='no' or attended='no').
    // Those go away from the rail entirely until the next day.
    const live = resolved.filter(r => r.planning !== 'no' && r.attended !== 'no');

    if (live.length === 0) {
      return { state: 'no_class_today', schedule: null, minutesUntilStart: null, minutesSinceEnd: null, loading };
    }

    // Pick: in-window > next upcoming > most-recently-ended.
    const inWindow = live.find(r => r.startMs <= nowMs && nowMs < r.endMs);
    const upcoming = live.filter(r => r.startMs > nowMs).sort((a, b) => a.startMs - b.startMs)[0];
    const ended    = live.filter(r => r.endMs <= nowMs).sort((a, b) => b.endMs - a.endMs)[0];
    const pick     = inWindow ?? upcoming ?? ended!;

    // Did a session get logged today? (Heuristic — match by date only.)
    const todayDate = date;
    const loggedToday = sessions.some(s => {
      const dateStr = typeof s.date === 'string' ? s.date.slice(0, 10) : '';
      return dateStr === todayDate;
    });

    let state: TodayState;
    if (pick === inWindow) {
      state = 'in_class';
    } else if (pick === upcoming) {
      state = pick.planning === 'yes' ? 'pre_class_planning' : 'pre_class_unanswered';
    } else {
      // class ended
      if (pick.attended === 'yes') {
        state = loggedToday ? 'logged' : 'post_class_attended_unlogged';
      } else if (loggedToday && pick.attended === null) {
        // Some users will go directly to "log a session" without first
        // tapping "Did you attend?" — treat that as implicit yes.
        state = 'logged';
      } else {
        state = 'post_class_unanswered';
      }
    }

    return {
      state,
      schedule: pick.schedule,
      minutesUntilStart: pick.minutesUntilStart,
      minutesSinceEnd: pick.minutesSinceEnd,
      loading,
    };
  // tick is included so flag mutations re-run this calc.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, sessions, loading, date, tick]);

  const setPlanning = useCallback((value: 'yes' | 'no') => {
    if (info.schedule) writeFlag(info.schedule.id, date, 'planning', value);
    setTick(t => t + 1);
  }, [info.schedule, date]);

  const setAttended = useCallback((value: 'yes' | 'no') => {
    if (info.schedule) writeFlag(info.schedule.id, date, 'attended', value);
    setTick(t => t + 1);
  }, [info.schedule, date]);

  return { ...info, setPlanning, setAttended };
}

/** Format a minute count as "in 2h 14m" / "in 45m" / "ended 2h ago". */
export function formatRelativeMinutes(minutes: number, suffix: 'until' | 'since'): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const compact = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return suffix === 'until' ? `in ${compact}` : `${compact} ago`;
}
