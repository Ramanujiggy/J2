import { INT_COLORS, PAGE_BG, PALE_YELLOW, SURFACE_3_BORDER } from '../../lib/theme.ts';
import type { SessionSummary } from '../../types/api.ts';
import { noteOf } from '../../lib/calendarBook.ts';

/** Moss → champagne → copper by intensity (DESIGN.md §Intensity). */
export function intensityColor(intensity: number | null | undefined): string {
  const i = Math.max(1, Math.min(5, Math.round(Number(intensity) || 3))) as 1 | 2 | 3 | 4 | 5;
  return INT_COLORS[i];
}

/** A champagne ring marks a session that was written about. */
export const WROTE_RING = `0 0 0 2px ${PAGE_BG}, 0 0 0 3px ${PALE_YELLOW}`;

/** One mark per session: filled by intensity, ringed when it has notes. */
export function SessionDot({ session, size = 8 }: { session: SessionSummary; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        backgroundColor: intensityColor(session.intensity),
        boxShadow: noteOf(session) ? WROTE_RING : 'none',
      }}
    />
  );
}

/** A day inside a chapter week: trained (filled), rest (outline) or outside (blank). */
export function DayMark({ sessions, state }: { sessions: SessionSummary[]; state: 'outside' | 'future' | 'past' }) {
  if (state === 'outside') return <span aria-hidden="true" style={{ width: 10, height: 10 }} />;
  if (sessions.length === 0) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 1px ${SURFACE_3_BORDER}`,
          opacity: state === 'future' ? 0.4 : 1,
        }}
      />
    );
  }
  const hardest = sessions.reduce((max, s) => Math.max(max, Number(s.intensity) || 0), 0);
  const wrote = sessions.some(s => noteOf(s));
  return (
    <span
      aria-hidden="true"
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: intensityColor(hardest),
        boxShadow: wrote ? WROTE_RING : 'none',
      }}
    />
  );
}

/** "Aug 3", or "Aug 3 – Sep 20" for a range; an open range ends with a dash. */
export function formatDay(dateKey: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', opts);
}

export function formatRange(start: string, end: string, ongoing: boolean): string {
  return ongoing ? `${formatDay(start)} –` : `${formatDay(start)} – ${formatDay(end)}`;
}
