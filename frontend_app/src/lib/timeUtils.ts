// Time helpers for class scheduling.
// Day-of-week alignment: matches the backend (0=Sun, 1=Mon, … 6=Sat) so it
// joins cleanly with class_schedules.day_of_week.

export const DOW_LABELS_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DOW_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LABELS_MIN   = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // for compact circle pickers

/** Detect the user's IANA timezone via the platform API. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Render "HH:MM" or "HH:MM:SS" → "7:00 PM". */
export function formatTime12(value: string): string {
  const [hh, mm] = value.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return value;
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm.toString().padStart(2, '0')} ${period}`;
}

/** "1h 30m" / "90 min" — duration_min → human label. */
export function formatDurationMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Compact line for a list row: "Mon · 7:00 PM · 90 min". */
export function formatScheduleSummary(dow: number, startTime: string, durationMin: number): string {
  return `${DOW_LABELS_SHORT[dow]} · ${formatTime12(startTime)} · ${formatDurationMin(durationMin)}`;
}

/** Cluster days into a presentable label: "Mon · Wed · Fri" or "Every day" or "Weekdays". */
export function summarizeDays(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every(d => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Open mat days';
  return days.slice().sort((a, b) => a - b).map(d => DOW_LABELS_SHORT[d]).join(' · ');
}
