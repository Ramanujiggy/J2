// Training Calendar — unified scrollable grid, one row per week.
// Columns: Month label | Mon–Sun (7 day cells) | Intention | Journal
// Sticky header keeps day labels visible. Month label appears at month boundaries.

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useCountUp } from '../hooks/useCountUp.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import SessionDetailModal from './SessionDetailModal.tsx';
import { CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, HEATMAP_REST, HEATMAP_FUTURE, HEATMAP_HEADER_BG, PALE_YELLOW, GLOW_SOFT, SURFACE_2, INT_COLORS } from '../lib/theme.ts';
import { giShare, nogiShare } from '../lib/sessionUtils.ts';
import type { SessionSummary, CalendarIntention } from '../types/api.ts';
export type { SessionSummary };

const HEATMAP_REST_PRIMARY = '#1A3226'; // rest days — slightly lighter than CARD_BG so cells sit above the surface
const HEATMAP_REST_ALT     = '#1B3427'; // alternate month rest (odd months)
const HEATMAP_FUTURE_ALT   = '#10241A'; // alternate month future-day color

const GRID_COLS_MOBILE  = '1.5rem repeat(7, minmax(0, 1fr))';
const GRID_COLS_DESKTOP = '2rem repeat(7, minmax(0, 1fr)) 13rem 7rem';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_ABBR = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// Calibrated to the day-of-week column header's natural height — same value
// the retired floating-month pill used as its `top: 36`. Keeping this as a
// named constant so the sticky month label and the column-header bar always
// stay in sync if either gets repadded.
const WEEKBAR_HEIGHT = 36;

const LEGEND = [
  { color: HEATMAP_REST,  label: 'Rest',     range: ''    },
  { color: INT_COLORS[1], label: 'Easy',     range: '1–2' },
  { color: INT_COLORS[3], label: 'Moderate', range: '3'   },
  { color: INT_COLORS[4], label: 'Hard',     range: '4'   },
  { color: INT_COLORS[5], label: 'Max',      range: '5'   },
] as const;

// Particles for the intention column on the active week
const INTENTION_COL_PARTICLES = [
  { left: '25%', bottom: 3, drift: '-3px', duration: 6.0, delay: 0.0 },
  { left: '65%', bottom: 2, drift: '4px',  duration: 6.4, delay: 2.0 },
] as const;

// Local-time date key — avoids UTC shift from toISOString()
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalize whatever the API sends for a date field into YYYY-MM-DD.
export function toDateKey(raw: unknown): string {
  if (raw instanceof Date) return localDateKey(raw);
  const s = String(raw);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s.slice(0, 10);
}

// Add `days` calendar days to a YYYY-MM-DD string
function addDaysToStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

export interface DayData {
  count: number;
  totalMinutes: number;
  maxIntensity: number;
  notes: string[];
}

export const EMPTY_DAY: DayData = { count: 0, totalMinutes: 0, maxIntensity: 0, notes: [] };

export function cellColor(day: DayData): string {
  if (day.count === 0)          return HEATMAP_REST;
  if (day.maxIntensity <= 2)    return INT_COLORS[day.maxIntensity === 1 ? 1 : 2];
  if (day.maxIntensity === 3)   return INT_COLORS[3];
  if (day.maxIntensity === 4)   return INT_COLORS[4];
  return INT_COLORS[5];
}

export function buildDayMap(sessions: SessionSummary[]): Map<string, DayData> {
  const map = new Map<string, DayData>();
  for (const s of sessions) {
    const key = toDateKey(s.date);
    const prev = map.get(key) ?? { ...EMPTY_DAY, notes: [] };
    map.set(key, {
      count: prev.count + 1,
      totalMinutes: prev.totalMinutes + Number(s.duration),
      maxIntensity: Math.max(prev.maxIntensity, Number(s.intensity)),
      notes: s.notes?.trim() ? [...prev.notes, s.notes.trim()] : prev.notes,
    });
  }
  return map;
}

interface WeekRow {
  days: { date: Date; day: DayData }[];
  monthLabel: string;
  isMonthStart: boolean;
  monthIndex: number;
}

function buildWeekRows(dayMap: Map<string, DayData>, year: number): { rows: WeekRow[]; year: number } {

  const jan1 = new Date(year, 0, 1);
  const dow = jan1.getDay();
  const offsetToMonday = dow === 0 ? 6 : dow - 1;
  const gridStart = new Date(year, 0, 1 - offsetToMonday);

  const dec31 = new Date(year, 11, 31);
  const rows: WeekRow[] = [];
  let cursor = new Date(gridStart);
  let lastMonth = -1;

  while (cursor <= dec31) {
    const days: WeekRow['days'] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + d);
      days.push({ date, day: dayMap.get(localDateKey(date)) ?? { ...EMPTY_DAY, notes: [] } });
    }

    const firstMonth = days[0]!.date.getMonth();
    const isMonthStart = firstMonth !== lastMonth;
    if (isMonthStart) lastMonth = firstMonth;

    rows.push({
      days,
      monthLabel: isMonthStart ? (MONTH_ABBR[firstMonth] ?? '') : '',
      isMonthStart,
      monthIndex: firstMonth,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return { rows, year };
}

export function computeStats(sessions: SessionSummary[], year: number) {
  const thisYear = sessions.filter(s => toDateKey(s.date).slice(0, 4) === String(year));
  const totalSessions = thisYear.length;
  const totalMinutes = thisYear.reduce((sum, s) => sum + Number(s.duration), 0);
  // 'both' (mig 025) counts 0.5 toward each side via giShare/nogiShare.
  const giMinutes    = thisYear.reduce((sum, s) => sum + Number(s.duration) * giShare(s.gi_nogi), 0);
  const nogiMinutes  = thisYear.reduce((sum, s) => sum + Number(s.duration) * nogiShare(s.gi_nogi), 0);

  const daySet = new Set(sessions.map(s => toDateKey(s.date)));

  // Current streak — walk backwards from today (or yesterday if no session today)
  const cursor = new Date();
  if (!daySet.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  const streakDays = new Set<string>();
  while (daySet.has(localDateKey(cursor))) {
    streakDays.add(localDateKey(cursor));
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak — walk the sorted unique-date list counting consecutive days
  const sortedDates = [...daySet].sort();
  let longestStreak = 0;
  let curRun = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      curRun = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]! + 'T00:00:00');
      prev.setDate(prev.getDate() + 1);
      curRun = localDateKey(prev) === sortedDates[i] ? curRun + 1 : 1;
    }
    if (curRun > longestStreak) longestStreak = curRun;
  }

  // Consistent weeks — consecutive ISO weeks (Mon–Sun) with 2+ sessions
  function isoWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday of week
    return localDateKey(d);
  }
  const weekMap = new Map<string, number>();
  for (const s of sessions) {
    const key = isoWeekKey(new Date(toDateKey(s.date) + 'T00:00:00'));
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  const todayForWeek = new Date();
  const todayDow = todayForWeek.getDay();
  const thisMonday = new Date(todayForWeek);
  thisMonday.setDate(todayForWeek.getDate() - (todayDow === 0 ? 6 : todayDow - 1));
  thisMonday.setHours(0, 0, 0, 0);
  const startMonday = new Date(thisMonday);
  if ((weekMap.get(localDateKey(thisMonday)) ?? 0) < 2) {
    startMonday.setDate(startMonday.getDate() - 7);
  }
  let consistentWeeks = 0;
  const weekCursor = new Date(startMonday);
  while ((weekMap.get(localDateKey(weekCursor)) ?? 0) >= 2) {
    consistentWeeks++;
    weekCursor.setDate(weekCursor.getDate() - 7);
  }

  return { totalSessions, totalMinutes, giMinutes, nogiMinutes, streak, streakDays, longestStreak, consistentWeeks };
}

interface TrainingHeatmapProps {
  sessions?: SessionSummary[];
  intentions?: CalendarIntention[];
  loading?: boolean;
  onSessionUpdated?: () => void;
  onGoToToday?: () => void;
  onLogSession?: (dateKey: string) => void;
  year?: number;
}

// Skeleton shimmer shown while sessions are fetching.
function HeatmapSkeleton() {
  return (
    <div className="rounded-2xl p-6 animate-pulse" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}>
      {/* Shimmer stats row */}
      <div className="flex gap-8 mb-6 pb-5 border-b border-white/10">
        {[80, 64, 56].map(w => (
          <div key={w}>
            <div className="h-8 rounded bg-white/10 mb-1" style={{ width: w }} />
            <div className="h-3 w-20 rounded bg-white/10" />
          </div>
        ))}
      </div>
      {/* Shimmer week rows */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-1 items-center">
            <div className="w-16 h-5 rounded bg-white/10 shrink-0" />
            {Array.from({ length: 7 }).map((__, j) => (
              <div key={j} className="flex-1 h-7 rounded bg-white/10" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainingHeatmap({ sessions = [], intentions = [], loading = false, onSessionUpdated, onGoToToday, onLogSession, year: yearProp }: TrainingHeatmapProps) {
  const [selectedSession, setSelectedSession] = useState<{ session: SessionSummary; date: Date } | null>(null);
  const [showGiSplit, setShowGiSplit] = useState(false);
  const [gridMaxH, setGridMaxH] = useState<number | undefined>(undefined);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef(false);

  // Sticky left-margin month labels handle the "what month am I in" affordance
  // now (see <StickyMonthLabel /> + the month-grouped sections in the render
  // tree). The center floating pill that used to sit at top:36 has retired —
  // it read as a transient app-y indicator instead of the editorial ledger
  // feel we want.

  // Measure available height for the grid so the whole card fits within the
  // visible main-content area — no outer page scroll, only the grid scrolls.
  // On mobile we read the bottom-nav's actual top edge (it's `position: fixed`,
  // so its rect already accounts for safe-area-inset-bottom on notched devices)
  // and subtract just the chrome that lives between the grid and the nav:
  // card padding-bottom (24) + page padding-bottom (24) + small buffer (4).
  useEffect(() => {
    function measure() {
      const el = scrollContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;

      let viewportBottom = window.innerHeight;
      if (isMobile) {
        const nav = document.querySelector('nav.sm\\:hidden') as HTMLElement | null;
        if (nav) viewportBottom = nav.getBoundingClientRect().top;
      }

      const belowGrid = isMobile ? 52 : 48;
      const available = viewportBottom - rect.top - belowGrid;
      setGridMaxH(Math.max(200, available));
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading, showGiSplit]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const currentCalYear = new Date().getFullYear();

  const handleTodayClick = useCallback(() => {
    const resolvedYear = yearProp ?? currentCalYear;
    if (resolvedYear === currentCalYear) {
      scrollContainerRef.current
        ?.querySelector('[data-today-row]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      pendingScroll.current = true;
      onGoToToday?.();
    }
  }, [yearProp, currentCalYear, onGoToToday]);

  // After parent switches back to the current year, scroll to today's row.
  useEffect(() => {
    if (!pendingScroll.current) return;
    const resolvedYear = yearProp ?? currentCalYear;
    if (resolvedYear !== currentCalYear) return;
    pendingScroll.current = false;
    requestAnimationFrame(() => {
      scrollContainerRef.current
        ?.querySelector('[data-today-row]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [yearProp, currentCalYear]);

  // Compute stats before hooks so useCountUp is called unconditionally
  const statsData = useMemo(() => {
    if (loading) return { totalSessions: 0, hoursNum: 0, giHoursNum: 0, nogiHoursNum: 0, streak: 0 };
    const { rows: _rows, year } = buildWeekRows(buildDayMap(sessions), yearProp ?? new Date().getFullYear());
    const { totalSessions, totalMinutes, giMinutes, nogiMinutes, streak } = computeStats(sessions, year);
    return {
      totalSessions,
      hoursNum: totalMinutes > 0 ? totalMinutes / 60 : 0,
      giHoursNum: giMinutes > 0 ? giMinutes / 60 : 0,
      nogiHoursNum: nogiMinutes > 0 ? nogiMinutes / 60 : 0,
      streak,
    };
  }, [loading, sessions, yearProp]);

  const animSessions = useCountUp(statsData.totalSessions);
  const animHours    = useCountUp(statsData.hoursNum);
  const animGi       = useCountUp(statsData.giHoursNum);
  const animNogi     = useCountUp(statsData.nogiHoursNum);
  const animStreak   = useCountUp(statsData.streak);

  if (loading) return <HeatmapSkeleton />;

  const now = new Date();
  const todayStr = localDateKey(now);
  const dayMap = buildDayMap(sessions);
  const { rows, year } = buildWeekRows(dayMap, yearProp ?? new Date().getFullYear());

  // Group rows into month sections. Each section becomes a `<section>` in the
  // render tree so that its sticky month label has a containing block bounded
  // by that month's rows — the label sticks at WEEKBAR_HEIGHT for the section
  // and is naturally displaced when the next section's label scrolls in.
  const monthGroups: { monthIndex: number; monthAbbr: string; rows: WeekRow[]; firstRowIndex: number }[] = [];
  rows.forEach((row, idx) => {
    if (row.isMonthStart || monthGroups.length === 0) {
      monthGroups.push({
        monthIndex: row.monthIndex,
        monthAbbr: MONTH_ABBR[row.monthIndex] ?? '',
        rows: [],
        firstRowIndex: idx,
      });
    }
    monthGroups[monthGroups.length - 1]!.rows.push(row);
  });
  // Index into DOW array (Mon=0 … Sun=6) for the current day — used to highlight today's column header.
  // Only applies when viewing the current year; -1 disables the highlight for past/future years.
  const todayDowIndex = year === now.getFullYear() ? (now.getDay() + 6) % 7 : -1;
  const { streakDays } = computeStats(sessions, year);

  const hours     = animHours > 0 ? animHours.toFixed(1) : '0';
  const giHours   = animGi > 0 ? animGi.toFixed(1) : '0';
  const nogiHours = animNogi > 0 ? animNogi.toFixed(1) : '0';

  // Helper: find the intention whose period overlaps a given calendar week.
  // An intention covers [intentStart, intentEnd] (inclusive).
  // A week row covers [weekStart, weekStart + 6 days].
  function findIntentionForWeek(weekStart: string): CalendarIntention | null {
    const weekEnd = addDaysToStr(weekStart, 6);
    return intentions.find(intent => {
      const intentStart = intent.week_start.slice(0, 10);
      const intentEnd   = addDaysToStr(intentStart, intent.duration_days - 1);
      return intentStart <= weekEnd && intentEnd >= weekStart;
    }) ?? null;
  }

  return (
    <>
    {/* Grid layout + intention animation keyframes */}
    <style>{`
      .j2-heatmap-grid { grid-template-columns: ${GRID_COLS_MOBILE}; }
      @media (min-width: 640px) { .j2-heatmap-grid { grid-template-columns: ${GRID_COLS_DESKTOP}; } }

      .j2-heatmap-month { font-size: 14px; }
      @media (min-width: 640px) { .j2-heatmap-month { font-size: 20px; } }

      /* Grid fills remaining card height via flex */

      @keyframes j2CalIntentRise {
        0%   { transform: translateY(0) translateX(0); opacity: 0; }
        8%   { opacity: 1; }
        85%  { opacity: 0.7; }
        100% { transform: translateY(-40px) translateX(var(--drift)); opacity: 0; }
      }
      @keyframes j2CalIntentGlow {
        0%   { opacity: 0.4; }
        50%  { opacity: 0.7; }
        100% { opacity: 0.4; }
      }
      @keyframes j2CalIntentFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .j2-cal-particle { animation: none !important; opacity: 0 !important; }
        .j2-cal-glow { animation: none !important; }
      }

      /* Year navigation — forward (next year): slides in from right */
      @keyframes j2PageFlipForward {
        from { opacity: 0.15; transform: translateX(20px); }
        to   { opacity: 1;    transform: translateX(0); }
      }
      /* Year navigation — back (prev year): slides in from left */
      @keyframes j2PageFlipBack {
        from { opacity: 0.15; transform: translateX(-20px); }
        to   { opacity: 1;    transform: translateX(0); }
      }
    `}</style>
    {/* Stacked journal pages peeking out below-right */}
    <div className="rounded-2xl p-6" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}>

      {/* Stats + intensity legend — one combined row to save vertical space.
          Left: Sessions / Hours / Streak as a 3-up grid. Right: 5-tile
          intensity ladder with a single "Intensity" caption underneath. */}
      <div className="flex items-end gap-4 mb-4 pb-4 border-b border-white/10">
        <div className="grid grid-cols-3 gap-4 flex-1 min-w-0">
          <div>
            <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{Math.round(animSessions)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(242,228,168,0.5)' }}>Sessions</p>
          </div>
          <div>
            <button
              onClick={() => setShowGiSplit(s => !s)}
              className="text-left w-full group"
            >
              <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{hours}h</p>
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(242,228,168,0.5)' }}>
                Hours
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  className="transition-transform"
                  style={{ transform: showGiSplit ? 'rotate(180deg)' : 'rotate(0)' }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </p>
            </button>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{Math.round(animStreak)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(196,145,95,0.65)' }}>Day streak</p>
          </div>
        </div>

        {/* Intensity ladder — 5 tiles, single caption. The Rest swatch is
            implied by the empty-day cells; it doesn't earn a tile here. */}
        {sessions.length > 0 && (
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex gap-0.5">
              {LEGEND.slice(1).map(({ color, label }) => (
                <div
                  key={label}
                  style={{ width: 16, height: 10, borderRadius: 2, backgroundColor: color }}
                />
              ))}
            </div>
            <span className="text-[10px] leading-none" style={{ color: 'rgba(196,145,95,0.7)', letterSpacing: '0.08em' }}>
              Easy → Max
            </span>
          </div>
        )}
      </div>

      {/* Gi / No-Gi breakdown — expandable under Hours */}
      {showGiSplit && (
        <div className="flex gap-6 mb-4 pb-4 border-b border-white/10" style={{ animation: 'j2CalIntentFadeIn 0.3s ease forwards' }}>
          <div>
            <p className="text-lg font-bold" style={{ color: PALE_YELLOW }}>{giHours}h</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(242,228,168,0.4)' }}>Gi</p>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: PALE_YELLOW }}>{nogiHours}h</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(242,228,168,0.4)' }}>No-Gi</p>
          </div>
        </div>
      )}

      {/* Month-jump navigation pills */}
      {sessions.length > 0 && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          {MONTH_ABBR.map((m, i) => {
            const isCurrent = i === now.getMonth() && year === now.getFullYear();
            return (
              <button
                key={m}
                onClick={() => {
                  const target = scrollContainerRef.current?.querySelector(`[data-month="${i}"]`);
                  target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex-shrink-0 touch-manipulation"
                style={{
                  backgroundColor: isCurrent ? 'rgba(196,145,95,0.2)' : SURFACE_2,
                  color: isCurrent ? 'rgba(242,228,168,0.9)' : 'rgba(242,228,168,0.45)',
                  border: isCurrent ? '1px solid rgba(196,145,95,0.4)' : '1px solid transparent',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-white/60 text-sm font-medium">No sessions logged yet.</p>
          <p className="text-white/30 text-sm mt-1">Log your first session above to start tracking your year.</p>
        </div>
      )}

      {/* Calendar grid — fills remaining viewport, scrolls internally */}
      {sessions.length > 0 && <div ref={scrollContainerRef} role="grid" aria-label={`Training calendar for ${year}`} className="overflow-y-auto relative" style={gridMaxH ? { maxHeight: gridMaxH } : undefined}>

        {/* Sticky column headers */}
        <div
          role="row"
          className="j2-heatmap-grid grid sticky top-0 z-20 border-b border-white/10 mb-0.5"
          style={{ backgroundColor: HEATMAP_HEADER_BG, boxShadow: '0 3px 10px rgba(0,0,0,0.6)' }}
        >
          <div role="columnheader" className="py-2" />
          {DOW.map((d, i) => {
            const isToday = i === todayDowIndex;
            return (
              <div
                key={d}
                role="columnheader"
                className="py-2 text-center text-xs font-semibold"
                style={{
                  color: isToday ? 'rgba(242,228,168,0.92)' : 'rgba(242,228,168,0.55)',
                  textShadow: isToday ? '0 0 10px rgba(242,228,168,0.35)' : 'none',
                }}
              >
                {d}
              </div>
            );
          })}
          <div role="columnheader" className="py-2 pl-4 text-xs font-semibold hidden sm:block" style={{ color: 'rgba(242,228,168,0.55)' }}>Intention</div>
          <div role="columnheader" className="py-2 pl-3 text-xs font-semibold hidden sm:block" style={{ color: 'rgba(242,228,168,0.55)' }}>Journal</div>
        </div>

        {/* Week rows — grouped into month sections so the sticky left-margin
            label can be bounded by its own month's vertical span. */}
        {monthGroups.map((group, gi) => (
          <section
            key={`m-${year}-${group.monthIndex}`}
            data-month={group.monthIndex}
            style={{
              position: 'relative',
              borderTop: gi > 0 ? '1px solid rgba(255,255,255,0.10)' : undefined,
              marginTop: gi > 0 ? 4 : 0,
              paddingTop: gi > 0 ? 4 : 0,
            }}
          >
            {/* Sticky month label — height: 0 so it doesn't push rows down;
                its absolutely-positioned child renders the abbr in the first
                grid column. Pinned at WEEKBAR_HEIGHT for the duration of
                this section. The next section's label naturally takes over
                when its own sticky reaches WEEKBAR_HEIGHT (the previous
                section has scrolled out, releasing its sticky child). */}
            <div
              aria-hidden
              style={{
                position: 'sticky',
                top: WEEKBAR_HEIGHT,
                height: 0,
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              <span
                className="font-semibold j2-heatmap-month"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 6,
                  width: isMobile ? '1.5rem' : '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: (group.monthIndex === now.getMonth() && year === now.getFullYear())
                    ? 'rgba(242,228,168,0.95)'
                    : 'rgba(242,228,168,0.6)',
                  textShadow: (group.monthIndex === now.getMonth() && year === now.getFullYear())
                    ? '0 0 10px rgba(242,228,168,0.45)'
                    : 'none',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  letterSpacing: '0.05em',
                }}
              >
                {group.monthAbbr}
              </span>
            </div>

            {group.rows.map((row) => {
              const ri = group.firstRowIndex + group.rows.indexOf(row);
          const weekNotes = row.days.flatMap(({ day }) => day.notes).filter(Boolean);
          const noteText = weekNotes[0] ?? '';
          const extraNotes = weekNotes.length > 1 ? ` +${weekNotes.length - 1}` : '';

          // Intention overlapping this calendar week (supports multi-week intentions)
          const weekStartKey  = localDateKey(row.days[0]!.date);
          const weekIntention = findIntentionForWeek(weekStartKey);
          const intentionStart = weekIntention ? weekIntention.week_start.slice(0, 10) : '';
          const intentionEnd   = weekIntention ? addDaysToStr(intentionStart, weekIntention.duration_days - 1) : '';
          const isActiveWeek   = !!weekIntention && todayStr >= intentionStart && todayStr <= intentionEnd;
          const isPastWeek     = !!weekIntention && !isActiveWeek;

          const isThisWeek = row.days.some(d => localDateKey(d.date) === todayStr);
          const isExpanded = expandedWeek === ri;
          const weekSessions = row.days.reduce((sum, d) => sum + d.day.count, 0);
          const weekMinutes = row.days.reduce((sum, d) => sum + d.day.totalMinutes, 0);
          const weekMaxIntensity = row.days.reduce((max, d) => Math.max(max, d.day.maxIntensity), 0);
          const weekFirstNote = weekNotes[0] ?? '';

          return (
            <div key={ri}>
            <div
              role="row"
              {...(isThisWeek ? { 'data-today-row': '' } : {})}
              className="j2-heatmap-grid grid items-center"
              style={{
                position: 'relative',
                cursor: isMobile && weekSessions > 0 ? 'pointer' : undefined,
              }}
              onClick={isMobile && weekSessions > 0 ? (e) => {
                // Only expand if the tap wasn't on a specific cell with sessions
                const target = e.target as HTMLElement;
                if (target.closest('.j2-heatmap-cell')) return;
                setExpandedWeek(isExpanded ? null : ri);
              } : undefined}
            >
              {/* Active week backdrop */}
              {isActiveWeek && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to right, transparent 0%, rgba(242,228,168,0.07) 12%, rgba(242,228,168,0.07) 88%, transparent 100%)',
                  pointerEvents: 'none', borderRadius: 6,
                  animation: 'j2CalIntentFadeIn 1.4s ease forwards',
                }} />
              )}

              {/* Leftmost cell — month abbr text now lives in the section's
                  sticky overlay above; this cell preserves the first-column
                  width and houses the per-week intention indicator on mobile. */}
              {(() => {
                return (
                  <div
                    className="j2-heatmap-month"
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                    }}
                  >
                    {/* Mobile intention indicator — visible only on small screens */}
                    {weekIntention && (
                      <span className="sm:hidden" style={{
                        fontSize: 8,
                        color: isActiveWeek ? 'rgba(196,145,95,0.9)' : 'rgba(196,145,95,0.4)',
                        lineHeight: 1,
                        marginTop: 2,
                      }}>◈</span>
                    )}
                  </div>
                );
              })()}

              {/* Day cells */}
              {row.days.map(({ date, day }) => {
                const key = localDateKey(date);
                const isFuture = date > now;
                const isCurrentYear = date.getFullYear() === year;
                const isClickable = isCurrentYear && day.count > 0;
                const isLoggable = isCurrentYear && !isFuture && day.count === 0 && !!onLogSession;
                const dateStr = date.toDateString();
                const tooltip = day.count === 0
                  ? (isLoggable ? `${dateStr} — tap to log session` : dateStr)
                  : `${dateStr}: ${day.count} session${day.count !== 1 ? 's' : ''} · ${day.totalMinutes} min · intensity ${day.maxIntensity}/5`;

                // Copper resonance: session logged on a day that falls within the intention period
                const dayDateStr  = localDateKey(date);
                const hasResonance = !!weekIntention && day.count > 0
                  && dayDateStr >= intentionStart && dayDateStr <= intentionEnd;
                // Champagne streak glow: trained day that is part of the current active streak
                const isInStreak = day.count > 0 && streakDays.has(dayDateStr);

                const isToday = key === todayStr;

                const handleClick = () => {
                  if (isClickable) {
                    const daySessions = sessions
                      .filter(s => toDateKey(s.date) === key)
                      .sort((a, b) => b.intensity - a.intensity);
                    if (daySessions[0]) setSelectedSession({ session: daySessions[0], date });
                  } else if (isLoggable) {
                    onLogSession!(key);
                  }
                };

                // Build accessible label for this cell
                const cellAriaLabel = day.count === 0
                  ? `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: rest day${isLoggable ? ' — tap to log session' : ''}`
                  : `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${day.count} session${day.count !== 1 ? 's' : ''}, ${day.totalMinutes} minutes, intensity ${day.maxIntensity} of 5`;

                const cellEl = (
                  <div role="gridcell" aria-label={cellAriaLabel} className="px-0.5 py-1" style={{ position: 'relative', zIndex: 1 }}>
                    <div
                      className={`rounded flex items-end px-1 j2-heatmap-cell${isInStreak ? ' j2-streak-cell' : ''}`}
                      style={{
                        position: 'relative',
                        height: '44px',
                        backgroundColor: (() => {
                          if (!isCurrentYear) return '#0D1812'; // flat muted — clearly inactive, no opacity trick
                          const isAltMonth = date.getMonth() % 2 === 1;
                          if (isFuture && day.count === 0) return isAltMonth ? HEATMAP_FUTURE_ALT : HEATMAP_FUTURE;
                          if (day.count === 0) return isAltMonth ? HEATMAP_REST_ALT : HEATMAP_REST_PRIMARY;
                          return cellColor(day);
                        })(),
                        cursor: (isClickable || isLoggable) ? 'pointer' : 'default',
                        paddingBottom: '3px',
                        border: hasResonance
                          ? '1px solid rgba(196,145,95,0.7)'
                          : '1px solid rgba(242,228,168,0.13)',
                        boxShadow: hasResonance
                          ? '0 0 8px 2px rgba(196,145,95,0.35), inset 0 0 5px rgba(196,145,95,0.18)'
                          : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}
                      onClick={handleClick}
                    >
                      {isToday && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0,
                            height: 2,
                            borderRadius: '3px 3px 0 0',
                            backgroundColor: 'rgba(242,228,168,0.7)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      {/* Journal note indicator dot */}
                      {day.notes.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 3, right: 3,
                            width: 4, height: 4,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(196,145,95,0.7)',
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      <span
                        className="leading-none select-none pointer-events-none whitespace-nowrap"
                        style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.80)' }}
                      >
                        {date.getDate()}
                        {!isMobile && day.count > 0 && ` | ${(day.totalMinutes / 60).toFixed(1)}h`}
                      </span>
                    </div>
                  </div>
                );

                return isMobile ? (
                  <div key={key}>{cellEl}</div>
                ) : (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>{cellEl}</TooltipTrigger>
                    <TooltipContent side="top"><p>{tooltip}</p></TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Intention column — hidden on mobile */}
              <div className="hidden sm:flex" style={{
                position: 'relative', overflow: 'hidden',
                paddingLeft: 16, alignItems: 'center',
                minHeight: 40, zIndex: 1,
              }}>
                {/* Active week: particle aura + lowlight glow */}
                {isActiveWeek && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    animation: 'j2CalIntentFadeIn 1.4s ease forwards',
                    pointerEvents: 'none',
                    WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, transparent 100%)',
                    maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, transparent 100%)',
                  }}>
                    <div className="j2-cal-glow" style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(242,228,168,0.22) 0%, transparent 100%)',
                      animation: 'j2CalIntentGlow 4s ease-in-out infinite',
                    }} />
                    {INTENTION_COL_PARTICLES.map((p, i) => (
                      <span key={i} className="j2-cal-particle" style={{
                        position: 'absolute',
                        left: p.left,
                        bottom: p.bottom,
                        width: 2,
                        height: 2,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(242,228,168,0.88)',
                        boxShadow: '0 0 5px 2px rgba(242,228,168,0.6)',
                        ['--drift' as string]: p.drift,
                        animation: `j2CalIntentRise ${p.duration}s ease-in-out ${p.delay}s infinite`,
                      }} />
                    ))}
                  </div>
                )}

                {weekIntention ? (
                  <span style={{
                    position: 'relative', zIndex: 1, fontSize: 11,
                    color: isActiveWeek ? 'rgba(242,228,168,0.9)' : 'rgba(242,228,168,0.28)',
                    fontWeight: isActiveWeek ? 600 : 400,
                    fontStyle: isPastWeek ? 'italic' : 'normal',
                  }}>
                    {isActiveWeek && '◈ '}{weekIntention.intent_label}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'rgba(242,228,168,0.3)' }} title={weekNotes.join(' · ')}>
                    {noteText}
                    {extraNotes && <span style={{ color: 'rgba(255,255,255,0.15)' }}>{extraNotes}</span>}
                  </span>
                )}
              </div>

              {/* Journal — placeholder, hidden on mobile */}
              <div className="hidden sm:block pl-3 text-xs text-white/15 italic select-none" style={{ position: 'relative', zIndex: 1 }}>—</div>
            </div>

            {/* Expandable week summary — mobile only */}
            {isMobile && isExpanded && weekSessions > 0 && (
              <div
                className="mx-1 mb-1 rounded-lg px-3 py-2"
                style={{
                  backgroundColor: SURFACE_2,
                  borderLeft: `2px solid rgba(196,145,95,0.5)`,
                  animation: 'j2CalIntentFadeIn 0.25s ease forwards',
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                  {weekSessions} session{weekSessions !== 1 ? 's' : ''} · {(weekMinutes / 60).toFixed(1)}h
                  {weekMaxIntensity > 0 && ` · ${['', 'Easy', 'Light', 'Moderate', 'Hard', 'Max'][weekMaxIntensity]} avg`}
                  {weekIntention && (
                    <span style={{ color: 'rgba(196,145,95,0.8)' }}> · ◈ {weekIntention.intent_label}</span>
                  )}
                </p>
                {weekFirstNote && (
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    "{weekFirstNote}"
                  </p>
                )}
              </div>
            )}
            </div>
          );
        })}
          </section>
        ))}

      </div>}

      {/* Floating "Today" pill — accessible at all scroll positions */}
      {sessions.length > 0 && (
        <button
          onClick={handleTodayClick}
          className="absolute bottom-5 right-5 z-30 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-lg"
          style={{
            backgroundColor: 'rgba(21,46,34,0.92)',
            border: '1px solid rgba(196,145,95,0.40)',
            color: 'rgba(242,228,168,0.85)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4), 0 0 18px rgba(196,145,95,0.18)',
          }}
        >
          Today
        </button>
      )}

      {/* Session detail / edit modal */}
      {selectedSession && (() => {
        // Find the intention covering the selected session's date
        const sessionDateKey = localDateKey(selectedSession.date);
        const sessionIntention = intentions.find(intent => {
          const start = intent.week_start.slice(0, 10);
          const end = addDaysToStr(start, intent.duration_days - 1);
          return sessionDateKey >= start && sessionDateKey <= end;
        }) ?? null;
        return (
          <SessionDetailModal
            session={selectedSession.session}
            date={selectedSession.date}
            intention={sessionIntention ? { intent_label: sessionIntention.intent_label, intent_category: sessionIntention.intent_category ?? null } : null}
            onClose={() => setSelectedSession(null)}
            onSaved={() => { onSessionUpdated?.(); setSelectedSession(null); }}
            onDeleted={() => { onSessionUpdated?.(); setSelectedSession(null); }}
          />
        );
      })()}

    </div>
    </>
  );
}
