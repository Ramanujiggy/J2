// useClassAttendance — server-side persistence layer for TodayCard's
// pre/post-class Yes/No prompts. Replaces the inline localStorage helpers
// that lived in useTodayClass before mig 029.
//
// Surface mirrors the old shape:
//   readFlag(scheduleId, date, flag)             → 'yes' | 'no' | null
//   setFlag(scheduleId, date, flag, value)       → fire-and-forget
//
// Internals:
//   • Module-level singleton Map keyed by `${scheduleId}:${date}` so
//     multiple useClassAttendance subscribers share state without a provider.
//   • On first mount: runs the one-time localStorage → server backfill,
//     then GETs the user's current ±7d attendance window.
//   • setFlag is optimistic: update the Map + write-through to localStorage
//     for instant + offline-resilient reads, then PUT to the server in the
//     background. If the PUT fails, the localStorage write keeps the answer
//     visible until the next online foreground.
//
// localStorage is intentionally still written on every setFlag — it acts as
// a warm cache so subsequent mounts have data before the GET resolves, and
// as a fallback for offline writes.

import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { migrateAttendanceToServer } from '../lib/migrateAttendanceToServer.ts';

export type AttendanceFlag = 'planning' | 'attended';
export type AttendanceValue = 'yes' | 'no' | null;

interface AttendanceRow {
  schedule_id: string;
  date: string;
  planning: 'yes' | 'no' | null;
  attended: 'yes' | 'no' | null;
}

interface AttendanceResponse {
  attendance: AttendanceRow[];
}

// ── Module-level shared state ─────────────────────────────────────────────

const cacheKey = (scheduleId: string, date: string): string => `${scheduleId}:${date}`;

interface FlagsForKey {
  planning: 'yes' | 'no' | null;
  attended: 'yes' | 'no' | null;
}

const cache = new Map<string, FlagsForKey>();
const subscribers = new Set<() => void>();

let mountState: 'idle' | 'loading' | 'ready' = 'idle';
let mountPromise: Promise<void> | null = null;

function notifyAll(): void {
  for (const cb of subscribers) cb();
}

// localStorage I/O — kept here for fallback + warm-cache purposes.
function writeLocalStorageFlag(
  scheduleId: string,
  date: string,
  flag: AttendanceFlag,
  value: AttendanceValue,
): void {
  if (typeof window === 'undefined') return;
  const key = `attendance.${scheduleId}.${date}.${flag}`;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // private mode / quota — silently degrade
  }
}

function readLocalStorageFlag(
  scheduleId: string,
  date: string,
  flag: AttendanceFlag,
): 'yes' | 'no' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`attendance.${scheduleId}.${date}.${flag}`);
    return raw === 'yes' || raw === 'no' ? raw : null;
  } catch {
    return null;
  }
}

// Seed the cache from localStorage so the first synchronous read returns
// real data before the GET round-trips. Called once at module init.
function seedCacheFromLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith('attendance.')) continue;
      // attendance.{scheduleId}.{YYYY-MM-DD}.{flag}
      const parts = key.split('.');
      if (parts.length !== 4) continue;
      const [, scheduleId, date, flag] = parts;
      if (!scheduleId || !date || (flag !== 'planning' && flag !== 'attended')) continue;
      const value = window.localStorage.getItem(key);
      if (value !== 'yes' && value !== 'no') continue;
      const ck = cacheKey(scheduleId, date);
      const existing = cache.get(ck) ?? { planning: null, attended: null };
      cache.set(ck, { ...existing, [flag]: value });
    }
  } catch {
    // private mode / quota — silently degrade
  }
}

function todayMinusDays(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayPlusDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// First mount kicks off: localStorage backfill → GET ±7d → populate cache
// from server (server is the source of truth, overrides local).
async function ensureMounted(): Promise<void> {
  if (mountState === 'ready') return;
  if (mountState === 'loading' && mountPromise) return mountPromise;
  mountState = 'loading';
  mountPromise = (async () => {
    seedCacheFromLocalStorage();
    globalVersion += 1;
    notifyAll();
    try {
      await migrateAttendanceToServer();
    } catch {
      // backfill is best-effort; if it fails the next mount retries
    }
    try {
      const from = todayMinusDays(7);
      const to = todayPlusDays(7);
      const res = await api.get<AttendanceResponse>(`/api/class-attendance?from=${from}&to=${to}`);
      for (const row of res.attendance ?? []) {
        cache.set(cacheKey(row.schedule_id, row.date), {
          planning: row.planning,
          attended: row.attended,
        });
      }
    } catch (err) {
      // 401 means we're not signed in; everything else is silent — the
      // localStorage seed already covered the visible state.
      if (!(err instanceof ApiError && err.status === 401)) {
        console.warn('useClassAttendance: failed to load attendance window', err);
      }
    } finally {
      mountState = 'ready';
      globalVersion += 1;
      notifyAll();
    }
  })();
  return mountPromise;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export interface UseClassAttendance {
  readFlag: (scheduleId: string, date: string, flag: AttendanceFlag) => 'yes' | 'no' | null;
  setFlag: (scheduleId: string, date: string, flag: AttendanceFlag, value: AttendanceValue) => void;
  isLoading: boolean;
  /** Monotonic counter that ticks on every cache mutation. Consumers can
   *  include this in `useMemo` deps to force re-evaluation of derived state
   *  (since the cache itself lives at module scope, React can't see it). */
  version: number;
}

// Module-level monotonic version. Bumped inside notifyAll so subscribers
// observe a new value after every mutation.
let globalVersion = 0;
const stableNotify = notifyAll;
function bumpAndNotify(): void {
  globalVersion += 1;
  stableNotify();
}

// readFlag / setFlag are stable across renders — no useCallback needed
// because they're plain module-level functions that close over the shared
// cache. Stable identity matters for `useMemo` deps in consumers.
function readFlag(scheduleId: string, date: string, flag: AttendanceFlag): 'yes' | 'no' | null {
  const entry = cache.get(cacheKey(scheduleId, date));
  return entry ? entry[flag] : null;
}

function setFlag(
  scheduleId: string,
  date: string,
  flag: AttendanceFlag,
  value: AttendanceValue,
): void {
  const ck = cacheKey(scheduleId, date);
  const existing = cache.get(ck) ?? { planning: null, attended: null };
  cache.set(ck, { ...existing, [flag]: value });
  writeLocalStorageFlag(scheduleId, date, flag, value);
  bumpAndNotify();
  // Background PUT — fire-and-forget; failures are swallowed because the
  // optimistic update + localStorage write already give the user visible
  // feedback. The next foreground retries via the GET.
  api.put('/api/class-attendance', {
    schedule_id: scheduleId,
    date,
    flag,
    value,
  }).catch(() => { /* silent */ });
}

export function useClassAttendance(): UseClassAttendance {
  const [version, setVersion] = useState(globalVersion);

  useEffect(() => {
    const cb = () => setVersion(globalVersion);
    subscribers.add(cb);
    void ensureMounted();
    // Pick up any version bumps that happened between render and subscribe.
    if (version !== globalVersion) setVersion(globalVersion);
    return () => { subscribers.delete(cb); };
    // version intentionally omitted — we only sync on mount. Subsequent
    // bumps are handled by the subscriber callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { readFlag, setFlag, isLoading: mountState !== 'ready', version };
}

// Test helper — clears the module-level cache. Not exported as part of the
// public API but available for tests that want a clean slate between cases.
export function _resetCacheForTests(): void {
  cache.clear();
  subscribers.clear();
  mountState = 'idle';
  mountPromise = null;
}

// Low-level localStorage helpers exposed for the migration script. Not used
// by the hook directly.
export const _localStorageHelpers = {
  read: readLocalStorageFlag,
  write: writeLocalStorageFlag,
};
