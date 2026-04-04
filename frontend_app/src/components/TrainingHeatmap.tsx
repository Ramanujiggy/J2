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
import { CARD_BG, COPPER_BORDER, CARD_SHADOW, HEATMAP_REST, HEATMAP_FUTURE, HEATMAP_OUTSIDE_YEAR, HEATMAP_HEADER_BG, PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';
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

const LEGEND = [
  { color: HEATMAP_REST, label: 'Rest' },
  { color: '#CDDFA0',    label: 'Easy' },
  { color: '#6FD08C',    label: 'Moderate' },
  { color: '#DA7422',    label: 'High' },
] as const;

// Particles for the intention column on the active week
const INTENTION_COL_PARTICLES = [
  { left: '8%',  bottom: 3, drift: '-3px', duration: 3.8, delay: 0.0 },
  { left: '22%', bottom: 2, drift: '4px',  duration: 4.5, delay: 1.1 },
  { left: '45%', bottom: 3, drift: '-4px', duration: 3.4, delay: 0.4 },
  { left: '65%', bottom: 2, drift: '3px',  duration: 4.1, delay: 1.7 },
  { left: '82%', bottom: 2, drift: '-3px', duration: 3.6, delay: 0.8 },
] as const;

// Local-time date key — avoids UTC shift from toISOString()
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalize whatever the API sends for a date field into YYYY-MM-DD.
function toDateKey(raw: unknown): string {
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

interface DayData {
  count: number;
  totalMinutes: number;
  maxIntensity: number;
  notes: string[];
}

const EMPTY_DAY: DayData = { count: 0, totalMinutes: 0, maxIntensity: 0, notes: [] };

function cellColor(day: DayData): string {
  if (day.count === 0)          return HEATMAP_REST;
  if (day.maxIntensity <= 2)    return '#CDDFA0';
  if (day.maxIntensity === 3)   return '#6FD08C';
  return '#DA7422';
}

function buildDayMap(sessions: SessionSummary[]): Map<string, DayData> {
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

function computeStats(sessions: SessionSummary[], year: number) {
  const thisYear = sessions.filter(s => toDateKey(s.date).slice(0, 4) === String(year));
  const totalSessions = thisYear.length;
  const totalMinutes = thisYear.reduce((sum, s) => sum + Number(s.duration), 0);
  const giMinutes    = thisYear.filter(s => s.gi_nogi === 'gi').reduce((sum, s) => sum + Number(s.duration), 0);
  const nogiMinutes  = thisYear.filter(s => s.gi_nogi === 'no_gi').reduce((sum, s) => sum + Number(s.duration), 0);

  const daySet = new Set(sessions.map(s => toDateKey(s.date)));
  const cursor = new Date();
  if (!daySet.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (daySet.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { totalSessions, totalMinutes, giMinutes, nogiMinutes, streak };
}

interface TrainingHeatmapProps {
  sessions?: SessionSummary[];
  intentions?: CalendarIntention[];
  loading?: boolean;
  onSessionUpdated?: () => void;
  onGoToToday?: () => void;
  year?: number;
}

// Skeleton shimmer shown while sessions are fetching.
function HeatmapSkeleton() {
  return (
    <div className="rounded-2xl p-6 animate-pulse" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}>
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

export default function TrainingHeatmap({ sessions = [], intentions = [], loading = false, onSessionUpdated, onGoToToday, year: yearProp }: TrainingHeatmapProps) {
  const [selectedSession, setSelectedSession] = useState<{ session: SessionSummary; date: Date } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef(false);

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
  const { totalSessions, totalMinutes, giMinutes, nogiMinutes, streak } = computeStats(sessions, year);
  const hoursNum  = totalMinutes > 0 ? totalMinutes / 60 : 0;
  const giHoursNum = giMinutes > 0 ? giMinutes / 60 : 0;
  const nogiHoursNum = nogiMinutes > 0 ? nogiMinutes / 60 : 0;

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

      .j2-heatmap-scroll { max-height: min(480px, 60dvh); }
      @media (min-width: 640px) { .j2-heatmap-scroll { max-height: 480px; } }

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

      /* Year navigation page flip — forward (next year): pivots at left spine */
      @keyframes j2PageFlipForward {
        0%   { transform: perspective(1000px) rotateY(22deg); transform-origin: left center; opacity: 0.35; }
        100% { transform: perspective(1000px) rotateY(0deg);  transform-origin: left center; opacity: 1; }
      }
      /* Year navigation page flip — back (prev year): pivots at right spine */
      @keyframes j2PageFlipBack {
        0%   { transform: perspective(1000px) rotateY(-22deg); transform-origin: right center; opacity: 0.35; }
        100% { transform: perspective(1000px) rotateY(0deg);   transform-origin: right center; opacity: 1; }
      }
    `}</style>
    {/* Stacked journal pages peeking out below-right */}
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'translate(8px, 2px)', borderRadius: '1rem', backgroundColor: CARD_BG, border: '1px solid rgba(196,145,95,0.15)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, transform: 'translate(4px, 1px)', borderRadius: '1rem', backgroundColor: CARD_BG, border: '1px solid rgba(196,145,95,0.25)', pointerEvents: 'none' }} />
    <div className="rounded-2xl p-6" style={{ position: 'relative', zIndex: 1, backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}>

      {/* Stats */}
      <div className="flex gap-6 mb-6 pb-5 border-b border-white/10 flex-wrap">
        <div>
          <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{Math.round(animSessions)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(242,228,168,0.5)' }}>Sessions in {year}</p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{hours}h</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(242,228,168,0.5)' }}>Hours trained</p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{giHours}h</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(242,228,168,0.5)' }}>Gi hours</p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{nogiHours}h</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(242,228,168,0.5)' }}>No-Gi hours</p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{Math.round(animStreak)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(242,228,168,0.5)' }}>Day streak</p>
        </div>
        <div className="ml-auto flex items-center">
          <button
            onClick={handleTodayClick}
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'rgba(242,228,168,0.08)',
              border: '1px solid rgba(242,228,168,0.22)',
              color: 'rgba(242,228,168,0.75)',
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-white/60 text-sm font-medium">No sessions logged yet.</p>
          <p className="text-white/30 text-sm mt-1">Log your first session above to start tracking your year.</p>
        </div>
      )}

      {/* Scrollable calendar — hidden when empty */}
      {sessions.length > 0 && <div ref={scrollContainerRef} className="overflow-y-auto relative j2-heatmap-scroll">

        {/* Sticky column headers */}
        <div
          className="j2-heatmap-grid grid sticky top-0 z-20 border-b border-white/10 mb-0.5"
          style={{ backgroundColor: HEATMAP_HEADER_BG, boxShadow: '0 3px 10px rgba(0,0,0,0.6)' }}
        >
          <div className="py-2" />
          {DOW.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium" style={{ color: 'rgba(242,228,168,0.5)' }}>
              {d}
            </div>
          ))}
          <div className="py-2 pl-4 text-xs font-medium hidden sm:block" style={{ color: 'rgba(242,228,168,0.5)' }}>Intention</div>
          <div className="py-2 pl-3 text-xs font-medium hidden sm:block" style={{ color: 'rgba(242,228,168,0.5)' }}>Journal</div>
        </div>

        {/* Week rows */}
        {rows.map((row, ri) => {
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
          return (
            <div
              key={ri}
              {...(isThisWeek ? { 'data-today-row': '' } : {})}
              className={`j2-heatmap-grid grid items-center${row.isMonthStart && ri > 0 ? ' mt-1 border-t border-white/10 pt-1' : ''}`}
              style={{ minHeight: 48, position: 'relative' }}
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

              {/* Month label */}
              {(() => {
                const isCurrentMonth = row.isMonthStart
                  && row.monthIndex === now.getMonth()
                  && year === now.getFullYear();
                return (
                  <div
                    className="font-semibold j2-heatmap-month"
                    style={{
                      color: isCurrentMonth ? 'rgba(242,228,168,0.95)' : 'rgba(242,228,168,0.6)',
                      textShadow: isCurrentMonth ? '0 0 10px rgba(242,228,168,0.45)' : 'none',
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
                    {row.monthLabel}
                  </div>
                );
              })()}

              {/* Day cells */}
              {row.days.map(({ date, day }) => {
                const key = localDateKey(date);
                const isFuture = date > now;
                const isCurrentYear = date.getFullYear() === year;
                const isClickable = isCurrentYear && day.count > 0;
                const dateStr = date.toDateString();
                const tooltip = day.count === 0
                  ? dateStr
                  : `${dateStr}: ${day.count} session${day.count !== 1 ? 's' : ''} · ${day.totalMinutes} min · intensity ${day.maxIntensity}/5`;

                // Copper resonance: session logged on a day that falls within the intention period
                const dayDateStr  = localDateKey(date);
                const hasResonance = !!weekIntention && day.count > 0
                  && dayDateStr >= intentionStart && dayDateStr <= intentionEnd;

                const handleClick = () => {
                  if (!isClickable) return;
                  const daySessions = sessions
                    .filter(s => toDateKey(s.date) === key)
                    .sort((a, b) => b.intensity - a.intensity);
                  if (daySessions[0]) setSelectedSession({ session: daySessions[0], date });
                };

                const cellEl = (
                  <div className="px-0.5 py-1" style={{ position: 'relative', zIndex: 1 }}>
                    <div
                      className="rounded flex items-end px-1 j2-heatmap-cell"
                      style={{
                        height: '40px',
                        backgroundColor: (() => {
                          if (!isCurrentYear) return '#0D1812'; // flat muted — clearly inactive, no opacity trick
                          const isAltMonth = date.getMonth() % 2 === 1;
                          if (isFuture && day.count === 0) return isAltMonth ? HEATMAP_FUTURE_ALT : HEATMAP_FUTURE;
                          if (day.count === 0) return isAltMonth ? HEATMAP_REST_ALT : HEATMAP_REST_PRIMARY;
                          return cellColor(day);
                        })(),
                        cursor: isClickable ? 'pointer' : 'default',
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
                      <span
                        className="leading-none select-none pointer-events-none whitespace-nowrap"
                        style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.65)' }}
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
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(242,228,168,0.22) 0%, transparent 100%)',
                      animation: 'j2CalIntentGlow 4s ease-in-out infinite',
                    }} />
                    {INTENTION_COL_PARTICLES.map((p, i) => (
                      <span key={i} style={{
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
          );
        })}

      </div>}

      {/* Legend — hidden when empty */}
      {sessions.length > 0 && <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/10 text-xs" style={{ color: 'rgba(242,228,168,0.5)' }}>
        <span>Intensity</span>
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="rounded-sm w-3 h-3" style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>}

      {/* Session detail / edit modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession.session}
          date={selectedSession.date}
          onClose={() => setSelectedSession(null)}
          onSaved={() => { onSessionUpdated?.(); setSelectedSession(null); }}
          onDeleted={() => { onSessionUpdated?.(); setSelectedSession(null); }}
        />
      )}

    </div>
    </div>{/* end stacked-pages wrapper */}
    </>
  );
}
