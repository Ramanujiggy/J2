// Annual radial — 52-week wedge ring viz for the desktop Path Ahead page.
//
// Geometry: each week is a pie wedge whose radial length scales with the
// minutes trained that week. Wedge fill color is derived from the intention
// active during that week (falling back to the most-used session tag, then
// to a neutral copper). Individual session dots sit just outside the outer
// ring; same-day sessions fan radially outward (bead-string, never stacked
// at the same point).
//
// Polish pass (Refero anchors: Stardust `309eb326`, Kin `a83c7ff1`, Lumy
// `d8a03f78`, Picnic `65440f81`, TIDE `f769be7a`):
//   • 7-stop center gradient kills the banding the user could see.
//   • Solid copper hairlines replace dashed guide rings (less visual noise).
//   • viewBox padded ±56px so cardinal-position month labels never clip.
//   • Month labels unified to tracked sans micro-caps (Plus Jakarta Sans).
//   • Year stays Cormorant; totals collapse to one tracked sans line.
//   • Session dots constant 3.2px copper, opacity encodes intensity, halo
//     via a Gaussian-blur SVG filter to lift them off the wedge beneath.
//   • Same-day collisions fan outward at +3.2px per session.
//   • 3-stage mount animation: hairlines first, wedges sweep with index
//     stagger, dots scale in last. No spinner needed.

import { useMemo } from 'react';
import type { SessionSummary, Intention } from '../../types/api.ts';
import { SKILL_COLORS } from './RadarChart.tsx';
import { toDateString } from '../../lib/sessionUtils.ts';
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

  // viewBox padding so month labels at the cardinal points don't clip.
  // Calibrated against the label radius below (rOuter + 32).
  const PAD = Math.round(size * 0.12);

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

  // ── Session dot positions (fan same-day collisions outward) ────────────
  const dotPlacements = useMemo(() => {
    type Placement = { id: string; x: number; y: number; intensity: number };
    // Group sessions by day so we can fan radially.
    const byDay = new Map<string, SessionSummary[]>();
    sessions.forEach(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      const d = new Date(key + 'T00:00:00');
      if (d.getFullYear() !== year) return;
      (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(s);
    });
    const out: Placement[] = [];
    byDay.forEach((bucket, key) => {
      // Highest-intensity session sits closest to the ring; lower-intensity
      // sessions fan outward. Stable secondary sort by id for deterministic layout.
      const ordered = [...bucket].sort((a, b) => {
        const dI = (b.intensity ?? 3) - (a.intensity ?? 3);
        return dI !== 0 ? dI : a.id.localeCompare(b.id);
      });
      const d = new Date(key + 'T00:00:00');
      const dayOfYear = (d.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000;
      const angle = (dayOfYear / 365) * 360 - 90;
      const a = (angle * Math.PI) / 180;
      ordered.forEach((s, idx) => {
        const r = rOuter + 12 + idx * 3.2;
        const intensity = Math.max(1, Math.min(5, s.intensity ?? 3));
        out.push({
          id: s.id,
          x: cx + r * Math.cos(a),
          y: cy + r * Math.sin(a),
          intensity,
        });
      });
    });
    return out;
  }, [sessions, year, cx, cy, rOuter]);

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const labelRadius = rOuter + 32;

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${size + PAD * 2} ${size + PAD * 2}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
    >
      <defs>
        {/* Soft champagne→copper falloff. Seven stops — Refero TIDE
            (`f769be7a`) + Calm hold-knob (`87a76086`) — kill the banding
            the 3-stop version showed on dark surfaces. */}
        <radialGradient id="ar-center-glow" cx="50%" cy="50%">
          <stop offset="0%"   stopColor={PALE_YELLOW} stopOpacity="0.18" />
          <stop offset="12%"  stopColor={PALE_YELLOW} stopOpacity="0.13" />
          <stop offset="28%"  stopColor={PALE_YELLOW} stopOpacity="0.08" />
          <stop offset="45%"  stopColor={COPPER}      stopOpacity="0.06" />
          <stop offset="62%"  stopColor={COPPER}      stopOpacity="0.03" />
          <stop offset="80%"  stopColor={COPPER}      stopOpacity="0.012" />
          <stop offset="100%" stopColor="#000"        stopOpacity="0" />
        </radialGradient>

        {/* Halo behind each session dot — lifts them off the wedge below. */}
        <filter id="ar-dot-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      <style>{`
        @keyframes ar-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ar-wedge-in {
          from { opacity: 0; }
          to   { opacity: var(--ar-op, 0.62); }
        }
        @keyframes ar-dot-in {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ar-anim { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* Ambient center glow */}
      <circle
        cx={cx} cy={cy} r={rOuter * 1.1}
        fill="url(#ar-center-glow)"
        className="ar-anim"
        style={{ animation: 'ar-fade-in 540ms ease-out both' }}
      />

      {/* Two faint inner guide rings + one solid copper hairline at the outer
          edge. Refero Kin (`a83c7ff1`) + Lumy (`d8a03f78`) — solid hairlines
          read editorial, dashes read engineering. */}
      <circle
        cx={cx} cy={cy} r={rInner + (rOuter - rInner) * 0.4}
        fill="none" stroke="rgba(196,145,95,0.06)" strokeWidth={1}
        className="ar-anim"
        style={{ animation: 'ar-fade-in 420ms ease-out both' }}
      />
      <circle
        cx={cx} cy={cy} r={rInner + (rOuter - rInner) * 0.7}
        fill="none" stroke="rgba(196,145,95,0.06)" strokeWidth={1}
        className="ar-anim"
        style={{ animation: 'ar-fade-in 420ms ease-out 60ms both' }}
      />
      <circle
        cx={cx} cy={cy} r={rOuter}
        fill="none" stroke="rgba(196,145,95,0.30)" strokeWidth={1}
        className="ar-anim"
        style={{ animation: 'ar-fade-in 420ms ease-out 120ms both' }}
      />

      {/* Week wedges — index-staggered sweep-in. */}
      {Array.from({ length: 52 }).map((_, w) => {
        const bucket = byWeek.get(w);
        const minutes = bucket ? bucket.reduce((a, s) => a + (s.duration ?? 0), 0) : 0;
        const fillLen = Math.min(1, minutes / maxMin);
        const rEnd = rInner + (rOuter - rInner) * fillLen;
        const color = weekColor[w];
        const isActive = activeWeek === w;
        const hasData = (bucket?.length ?? 0) > 0;
        const targetOpacity = isActive ? 1 : (hasData ? 0.62 : 0.08);
        return (
          <path
            key={w}
            d={weekArc(w, rInner, rEnd)}
            fill={color}
            stroke={isActive ? PALE_YELLOW : 'none'}
            strokeWidth={1}
            className="ar-anim"
            style={{
              cursor: hasData && onWeekClick ? 'pointer' : 'default',
              transition: 'opacity 180ms ease',
              animation: `ar-wedge-in 540ms ease-out ${260 + w * 11}ms both`,
              ['--ar-op' as string]: targetOpacity,
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

      {/* Session dots — constant size + opacity-encoded intensity, copper hue,
          haloed. Same-day sessions fan radially outward (bead-string) instead
          of stacking at one angle. */}
      {dotPlacements.map((p, idx) => {
        const haloOpacity = 0.18 + (p.intensity - 1) * 0.04; // 0.18..0.34
        const dotOpacity  = 0.50 + (p.intensity - 1) * 0.12; // 0.50..0.98
        return (
          <g
            key={p.id}
            className="ar-anim"
            style={{
              transformOrigin: `${p.x}px ${p.y}px`,
              animation: `ar-dot-in 320ms ease-out ${900 + idx * 6}ms both`,
            }}
          >
            <circle
              cx={p.x} cy={p.y} r={4.6}
              fill={COPPER}
              opacity={haloOpacity}
              filter="url(#ar-dot-glow)"
            />
            <circle
              cx={p.x} cy={p.y} r={1.9}
              fill={COPPER}
              opacity={dotOpacity}
            />
          </g>
        );
      })}

      {/* Month labels — tracked sans micro-caps. Picnic (`65440f81`) +
          Stardust (`6d2995b2`) register: small, tracked, never overpowering
          the data. */}
      {months.map((m, i) => {
        const a = ((i / 12) * 360 - 90 - 3) * Math.PI / 180;
        return (
          <text
            key={m}
            x={cx + labelRadius * Math.cos(a)}
            y={cy + labelRadius * Math.sin(a)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily='"Plus Jakarta Sans", system-ui, -apple-system, sans-serif'
            fontSize={10}
            fontWeight={500}
            letterSpacing={1.6}
            fill="rgba(242,228,168,0.62)"
            className="ar-anim"
            style={{ animation: 'ar-fade-in 420ms ease-out 80ms both' }}
          >
            {m}
          </text>
        );
      })}

      {/* Center text — year (Cormorant) + a single tracked-sans totals line. */}
      <g
        className="ar-anim"
        style={{ animation: 'ar-fade-in 540ms ease-out 300ms both' }}
      >
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontFamily='"Cormorant Garamond", Georgia, serif'
          fontSize={size * 0.11}
          fontWeight={500}
          fill={PALE_YELLOW}
          style={{ filter: 'drop-shadow(0 0 14px rgba(242,228,168,0.45))' }}
        >
          {year}
        </text>
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          fontFamily='"Plus Jakarta Sans", system-ui, -apple-system, sans-serif'
          fontSize={9.5}
          fontWeight={600}
          letterSpacing={1.6}
          fill="rgba(242,228,168,0.55)"
        >
          {totalSessions} {totalSessions === 1 ? 'SESSION' : 'SESSIONS'} · {totalHours} {totalHours === 1 ? 'HR' : 'HRS'}
        </text>
      </g>
    </svg>
  );
}
