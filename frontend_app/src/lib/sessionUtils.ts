// ── Date helpers ───────────────────────────────────────────────────────────

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ISO Monday (YYYY-MM-DD) for a given date, using local timezone
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateString(d);
}

// Adds (days - 1) days to a YYYY-MM-DD string (start day counts as day 1)
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days - 1);
  return toDateString(d);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Day card intensity colors (lighter than heatmap — optimized for card top accent bar)
export const INTENSITY_COLOR: Record<number, string> = {
  1: '#A8CB72',
  2: '#A8CB72',
  3: '#4BA862',
  4: '#D4A040',   // warm amber mid-step
  5: '#DA7422',
};

export const SESSION_TYPE_LABELS: Record<string, string> = {
  class:                'Class',
  drilling:             'Drilling',
  competition_training: 'Competition',
};
