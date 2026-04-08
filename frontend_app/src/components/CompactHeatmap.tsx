// Compact heatmap — GitHub contribution-graph style, widget-ready.
// Purely visual: no modals, no tooltips, no click handlers.

import { useMemo, useRef, useEffect } from 'react';
import { useCountUp } from '../hooks/useCountUp.ts';
import { localDateKey, buildDayMap, cellColor, computeStats, EMPTY_DAY } from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import { CARD_BG, COPPER_BORDER, CARD_SHADOW, HEATMAP_REST, PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_2_BORDER } from '../lib/theme.ts';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const LEGEND = [
  { color: HEATMAP_REST, label: 'Rest' },
  { color: '#CDDFA0',    label: 'Easy' },
  { color: '#6FD08C',    label: 'Moderate' },
  { color: '#DA7422',    label: 'High' },
] as const;

interface WeekColumn {
  days: { date: Date; day: DayData }[];
  monthIndex: number;
  isMonthStart: boolean;
}

function buildWeekColumns(dayMap: Map<string, DayData>, year: number): WeekColumn[] {
  const jan1 = new Date(year, 0, 1);
  const dow = jan1.getDay();
  const offsetToMonday = dow === 0 ? 6 : dow - 1;
  const gridStart = new Date(year, 0, 1 - offsetToMonday);
  const dec31 = new Date(year, 11, 31);

  const cols: WeekColumn[] = [];
  let cursor = new Date(gridStart);
  let lastMonth = -1;

  while (cursor <= dec31) {
    const days: WeekColumn['days'] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + d);
      days.push({ date, day: dayMap.get(localDateKey(date)) ?? { ...EMPTY_DAY, notes: [] } });
    }

    const firstMonth = days[0]!.date.getMonth();
    const isMonthStart = firstMonth !== lastMonth;
    if (isMonthStart) lastMonth = firstMonth;

    cols.push({ days, monthIndex: firstMonth, isMonthStart });
    cursor.setDate(cursor.getDate() + 7);
  }

  return cols;
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function CompactSkeleton() {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}
    >
      {/* Stats skeleton */}
      <div className="flex gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-xl animate-pulse"
            style={{ height: 56, backgroundColor: SURFACE_2 }}
          />
        ))}
      </div>
      {/* Grid skeleton */}
      <div className="animate-pulse rounded-xl" style={{ height: 120, backgroundColor: SURFACE_2 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface CompactHeatmapProps {
  sessions: SessionSummary[];
  year: number;
  loading?: boolean;
}

export default function CompactHeatmap({ sessions, year, loading = false }: CompactHeatmapProps) {
  if (loading) return <CompactSkeleton />;

  const dayMap = useMemo(() => buildDayMap(sessions), [sessions]);
  const columns = useMemo(() => buildWeekColumns(dayMap, year), [dayMap, year]);
  const stats = useMemo(() => computeStats(sessions, year), [sessions, year]);

  const today = localDateKey(new Date());
  const totalCols = columns.length;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to today's column on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const todayDate = new Date();
    if (todayDate.getFullYear() !== year) return;
    const dayOfYear = Math.floor((todayDate.getTime() - new Date(year, 0, 1).getTime()) / 86400000);
    const colIndex = Math.floor(dayOfYear / 7);
    const cellWidth = 14 + 3; // cell size + gap
    const scrollTarget = colIndex * cellWidth - el.clientWidth / 2 + cellWidth * 3;
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [year, columns]);

  // Animated stats
  const animSessions = useCountUp(stats.totalSessions);
  const animHours = useCountUp(Math.round(stats.totalMinutes / 60));
  const animStreak = useCountUp(stats.streak);
  const giPct = stats.totalMinutes > 0 ? Math.round((stats.giMinutes / stats.totalMinutes) * 100) : 0;
  const animGiPct = useCountUp(giPct);

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}
    >
      {/* ── Stats row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-5">
        {[
          { value: Math.round(animSessions), label: 'Sessions' },
          { value: Math.round(animHours), label: 'Hours', suffix: 'h' },
          { value: Math.round(animGiPct), label: 'Gi', suffix: '%' },
          { value: Math.round(animStreak), label: 'Streak', suffix: 'd' },
        ].map(({ value, label, suffix }) => (
          <div
            key={label}
            className="rounded-xl px-2 py-3 text-center"
            style={{ backgroundColor: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}` }}
          >
            <div
              className="text-lg sm:text-xl font-bold tabular-nums"
              style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
            >
              {value}{suffix ?? ''}
            </div>
            <div className="text-[10px] sm:text-xs text-white/35 uppercase tracking-wider mt-0.5">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Scrollable heatmap area ──────────────────────────────────── */}
      <style>{`.j2-heatmap-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={scrollRef}
        className="j2-heatmap-scroll"
        style={{
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Month labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${totalCols}, 14px)`,
            gap: 3,
            marginBottom: 4,
          }}
        >
          {columns.map((col, i) => (
            <div key={i} style={{ minWidth: 0 }}>
              {col.isMonthStart && (
                <span
                  className="text-[9px] sm:text-[10px] font-medium"
                  style={{ color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}
                >
                  {MONTH_ABBR[col.monthIndex]}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Heatmap grid (7 rows × N columns) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${totalCols}, 14px)`,
            gridTemplateRows: 'repeat(7, 14px)',
            gridAutoFlow: 'column',
            gap: 3,
          }}
        >
          {columns.flatMap((col, colIdx) =>
            col.days.map(({ date, day }, rowIdx) => {
              const key = localDateKey(date);
              const inYear = date.getFullYear() === year;
              const isFuture = key > today;
              const bg = !inYear
                ? 'rgba(13,24,18,0.18)'
                : isFuture
                  ? '#10241A'
                  : cellColor(day);

              return (
                <div
                  key={`${colIdx}-${rowIdx}`}
                  style={{
                    borderRadius: 3,
                    backgroundColor: bg,
                    transition: 'transform 0.2s ease',
                    ...(key === today ? {
                      outline: '1.5px solid rgba(196,145,95,0.7)',
                      outlineOffset: -1,
                    } : {}),
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 mt-4">
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, display: 'inline-block' }} />
            <span className="text-[10px] sm:text-xs text-white/35">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
