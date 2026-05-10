// One-time migration of TodayCard's localStorage `attendance.*` keys to the
// new server-side `class_attendance` table (mig 029).
//
// Runs once per device on first mount of useClassAttendance after this code
// ships. The `j2_attendance_migrated_to_server` flag prevents re-runs;
// because the import endpoint UPSERTs, even if the flag is somehow lost
// the second run is idempotent.
//
// We DON'T delete the original localStorage keys after import — they stay
// as a fallback warm cache that useClassAttendance still reads on mount.
// A later release can deprecate them once the server-side path has been
// the default for long enough.

import { api } from './api.ts';

const MIGRATED_FLAG = 'j2_attendance_migrated_to_server';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ImportEntry {
  schedule_id: string;
  date: string;
  planning?: 'yes' | 'no' | null;
  attended?: 'yes' | 'no' | null;
}

// Walk localStorage, group by (scheduleId, date), emit one entry per pair.
// Entries with neither flag set are skipped (defensive — shouldn't happen
// but a malformed key shouldn't trigger an all-NULL row insert).
function scanLocalStorageForAttendanceEntries(): ImportEntry[] {
  if (typeof window === 'undefined') return [];

  const groups = new Map<string, ImportEntry>();
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith('attendance.')) continue;
      const parts = key.split('.');
      // Shape: attendance.{scheduleId}.{YYYY-MM-DD}.{flag}
      if (parts.length !== 4) continue;
      const [, scheduleId, date, flag] = parts;
      if (!scheduleId || !UUID_RE.test(scheduleId)) continue;
      if (!date || !DATE_RE.test(date)) continue;
      if (flag !== 'planning' && flag !== 'attended') continue;
      const value = window.localStorage.getItem(key);
      if (value !== 'yes' && value !== 'no') continue;

      const groupKey = `${scheduleId}:${date}`;
      const existing = groups.get(groupKey) ?? { schedule_id: scheduleId, date };
      existing[flag] = value;
      groups.set(groupKey, existing);
    }
  } catch {
    return [];
  }
  return Array.from(groups.values());
}

export async function migrateAttendanceToServer(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(MIGRATED_FLAG) === '1') return;
  } catch {
    return; // can't read localStorage, nothing to do
  }

  const entries = scanLocalStorageForAttendanceEntries();
  if (entries.length === 0) {
    try { window.localStorage.setItem(MIGRATED_FLAG, '1'); } catch { /* silent */ }
    return;
  }

  try {
    await api.post('/api/class-attendance/import', { entries });
    try { window.localStorage.setItem(MIGRATED_FLAG, '1'); } catch { /* silent */ }
  } catch {
    // Failed — likely 401 (not signed in yet) or network. The next mount
    // tries again; the backend UPSERT keeps it idempotent.
  }
}
