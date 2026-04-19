// Annual radial — 52-week wedge ring viz for the desktop Path Ahead page.
//
// Geometry: each week is a pie wedge whose radial length scales with the
// minutes trained that week. Wedge fill color is derived from the intention
// active during that week (falling back to the most-used session tag, then
// to a neutral copper). Individual session dots sit just outside the outer
// ring, placed at each session's day-of-year angle, sized by intensity.
//
// Center: year label + session + hour totals.

import { useMemo } from 'react';
import type { SessionSummary, Intention } from '../../types/api.ts';
import { SKILL_COLORS } from './RadarChart.tsx';
import { INTENSITY_COLOR, toDateString } from '../../lib/sessionUtils.ts';
import { PALE_YELLOW, COPPER } from '../../lib/theme.ts';

// Fallback wedge color for weeks with no intention + no session-tag signal
const NEUTRAL_WEDGE = 'rgba(196,145,95,0.55)'; // dim copper

interface Props {
  sessions: SessionSummary[];
  intentions: Intention[];
  year: number;
  size?: number;
  activeWeek?: number | null;
  onWeekClick?: (week: number, weekSessions: SessionSummary[]) => void;
}

/** ISO week-of-year as measured from Jan 1 (same approach used by the
 *  desktop reference — good enough for a visual 52-slot ring; we don't
 *  need ISO-8601 week conformance here). */
function weekOfYear(dateStr: string, yearStart: Date): number {
  const t = new Date(dateStr + 'T00:00:00').getTime() - yearStart.getTime();
  return Math.floor(t / (7 * 86_400_000));
}

export default function AnnualRadial({
  sessions,
  intentions,
  year,
  size = 480,
  activeWeek,
  onWeekClick,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rInner = size * 0.22;
  const rOuter = size * 0.46;

  // ── Group sessions by week ─────────────────────────────────────────────
  const byWeek = useMemo(() => {
    const yearStart = new Date(year, 0, 1);
    const map = new Map<number, SessionSummary[]>();
    sessions.forEach(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      const d = new Date(key + 'T00:00:00');
      if (d.getFullYear() !== year) return;
      const w = weekOfYear(key, yearStart);
      if (w < 0 || w > 51) return;
      const bucket = map.get(w) ?? [];
      bucket.push(s);
      map.set(w, bucket);
    });
    return map;
  }, [sessions, year]);

  // ── Determine each week's focus color (intention heading → session tag → neutral) ──
  const weekColor = useMemo(() => {
    const yearStart = new Date(year, 0, 1);
    const colors = new Array<string>(52).fill(NEUTRAL_WEDGE);

    // Intention pass — an intention covering the Monday of the week wins
    for (let w = 0; w < 52; w++) {
      const weekMid = new Date(yearStart);
      weekMid.setDate(yearStart.getDate() + w * 7 + 3);
      const midStr = toDateString(weekMid);
      const cov = intentions.find(i => {
        const start = i.week_start.slice(0, 10);
        // Compute end from start + duration_days - 1
        const endDate = new Date(start + 'T00:00:00');
        endDate.setDate(endDate.getDate() + (i.duration_days ?? 7) - 1);
        const endStr = toDateString(endDate);
        return midStr >= start && midStr <= endStr && i.heading;
      });
      if (cov?.heading) {
        colors[w] = SKILL_COLORS[cov.heading]?.stroke ?? NEUTRAL_WEDGE;
      }
    }

    // Fallback: if still neutral, use the week's most-common session tag
    byWeek.forEach((bucket, w) => {
      if (colors[w] !== NEUTRAL_WEDGE) return;
      const counts: Record<string, number> = {};
      for (const s of bucket) {
        const tag = s.tags?.[0];
        if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top) colors[w] = SKILL_COLORS[top]?.stroke ?? NEUTRAL_WEDGE;
    });

    return colors;
  }, [year, intentions, byWeek]);

  // ── Wedge geometry ─────────────────────────────────────────────────────
  const weekArc = (w: number, rStart: number, rEnd: number) => {
    const a0 = ((w / 52) * 360 - 90) * Math.PI / 180;
    const a1 = (((w + 1) / 52) * 360 - 90) * Math.PI / 180;
    const p0 = [cx + rStart * Math.cos(a0), cy + rStart * Math.sin(a0)];
    const p1 = [cx + rEnd * Math.cos(a0), cy + rEnd * Math.sin(a0)];
    const p2 = [cx + rEnd * Math.cos(a1), cy + rEnd * Math.sin(a1)];
    const p3 = [cx + rStart * Math.cos(a1), cy + rStart * Math.sin(a1)];
    return `M${p0[0]},${p0[1]} L${p1[0]},${p1[1]} A${rEnd},${rEnd} 0 0 1 ${p2[0]},${p2[1]} L${p3[0]},${p3[1]} A${rStart},${rStart} 0 0 0 ${p0[0]},${p0[1]} Z`;
  };

  // ── Totals for center label ────────────────────────────────────────────
  const { totalSessions, totalHours } = useMemo(() => {
    const inYear = sessions.filter(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      return new Date(key + 'T00:00:00').getFullYear() === year;
    });
    return {
      totalSessions: inYear.length,
      totalHours: Math.round(inYear.reduce((a, s) => a + (s.duration ?? 0), 0) / 60),
    };
  }, [sessions, year]);

  // Max weekly minutes for radial scaling — floor at 240 so an empty year
  // still looks like a ring and a single huge week doesn't blow out the scale
  const maxMin = useMemo(() => {
    let m = 240;
    byWeek.forEach(bucket => {
      const sum = bucket.reduce((a, s) => a + (s.duration ?? 0), 0);
      if (sum > m) m = sum;
    });
    return m;
  }, [byWeek]);

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="ar-center-glow" cx="50%" cy="50%">
          <stop offset="0%"   stopColor={PALE_YELLOW} stopOpacity="0.15" />
          <stop offset="60%"  stopColor={COPPER}      stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000"        stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient center glow */}
      <circle cx={cx} cy={cy} r={rOuter * 1.1} fill="url(#ar-center-glow)" />

      {/* 3 concentric guide rings (40/70/100% of the annular span) */}
      {[0.4, 0.7, 1].map((t, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={rInner + (rOuter - rInner) * t}
          fill="none"
          stroke="rgba(196,145,95,0.12)"
          strokeDasharray="2 4"
        />
      ))}

      {/* Week wedges */}
      {Array.from({ length: 52 }).map((_, w) => {
        const bucket = byWeek.get(w);
        const minutes = bucket ? bucket.reduce((a, s) => a + (s.duration ?? 0), 0) : 0;
        const fillLen = Math.min(1, minutes / maxMin);
        const rEnd = rInner + (rOuter - rInner) * fillLen;
        const color = weekColor[w];
        const isActive = activeWeek === w;
        const hasData = (bucket?.length ?? 0) > 0;
        return (
          <path
            key={w}
            d={weekArc(w, rInner, rEnd)}
            fill={color}
            opacity={isActive ? 1 : (hasData ? 0.62 : 0.08)}
            stroke={isActive ? PALE_YELLOW : 'none'}
            strokeWidth={1}
            style={{
              cursor: hasData && onWeekClick ? 'pointer' : 'default',
              transition: 'opacity 180ms ease',
            }}
            onClick={() => { if (hasData && bucket) onWeekClick?.(w, bucket); }}
          >
            <title>
              {hasData
                ? `Week ${w + 1} · ${bucket!.length} session${bucket!.length > 1 ? 's' : ''} · ${Math.round(minutes / 60 * 10) / 10}h`
                : `Week ${w + 1} · rest`}
            </title>
          </path>
        );
      })}

      {/* Individual session dots — just outside the outer ring */}
      {sessions.map(s => {
        const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
        const d = new Date(key + 'T00:00:00');
        if (d.getFullYear() !== year) return null;
        const dayOfYear = (d.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000;
        const angle = (dayOfYear / 365) * 360 - 90;
        const a = (angle * Math.PI) / 180;
        const intensity = Math.max(1, Math.min(5, s.intensity ?? 3));
        const r = rOuter + 10 + intensity * 1.6;
        return (
          <circle
            key={s.id}
            cx={cx + r * Math.cos(a)}
            cy={cy + r * Math.sin(a)}
            r={1.8}
            fill={INTENSITY_COLOR[intensity] ?? '#CDDFA0'}
            opacity={0.9}
          />
        );
      })}

      {/* Month labels — outer */}
      {months.map((m, i) => {
        const a = ((i / 12) * 360 - 90 - 3) * Math.PI / 180;
        const r = rOuter + 34;
        return (
          <text
            key={m}
            x={cx + r * Math.cos(a)}
            y={cy + r * Math.sin(a)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13}
            fontWeight={600}
            letterSpacing={2.2}
            fill="rgba(255,255,255,0.58)"
          >
            {m}
          </text>
        );
      })}

      {/* Center text — year + totals */}
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fontFamily='"Cormorant Garamond", Georgia, serif'
        fontSize={36}
        fontWeight={600}
        fill={PALE_YELLOW}
        style={{ filter: 'drop-shadow(0 0 14px rgba(242,228,168,0.5))' }}
      >
        {year}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize={10.5}
        letterSpacing={2}
        fontWeight={700}
        fill="rgba(255,255,255,0.40)"
      >
        {totalSessions} SESSION{totalSessions === 1 ? '' : 'S'}
      </text>
      <text
        x={cx}
        y={cy + 30}
        textAnchor="middle"
        fontSize={10.5}
        letterSpacing={2}
        fontWeight={500}
        fill="rgba(196,145,95,0.80)"
      >
        {totalHours} HOUR{totalHours === 1 ? '' : 'S'}
      </text>
    </svg>
  );
}
