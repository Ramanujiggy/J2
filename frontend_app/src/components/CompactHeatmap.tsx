// Compact heatmap — vertical-scroll layout (weeks as rows, days as columns).
// Purely visual: no modals, no tooltips, no click handlers.

import { useMemo, useRef, useEffect } from 'react';
import { useCountUp } from '../hooks/useCountUp.ts';
import { localDateKey, buildDayMap, cellColor, computeStats, EMPTY_DAY } from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import { CARD_BG, COPPER_BORDER, CARD_SHADOW, HEATMAP_REST, PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_2_BORDER, INT_COLORS } from '../lib/theme.ts';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const CELL_GAP = 4;

const LEGEND = [
  { color: HEATMAP_REST,  label: 'Rest' },
  { color: INT_COLORS[1], label: 'Easy' },
  { color: INT_COLORS[3], label: 'Moderate' },
  { color: INT_COLORS[5], label: 'High' },
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
      <div className="animate-pulse rounded-xl" style={{ height: 200, backgroundColor: SURFACE_2 }} />
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRowRef = useRef<HTMLDivElement>(null);

  // Scroll to today's week on mount
  useEffect(() => {
    const container = scrollRef.current;
    const row = todayRowRef.current;
    if (!container || !row) return;
    const todayDate = new Date();
    if (todayDate.getFullYear() !== year) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [year, columns]);

  // Animated stats
  const animSessions = useCountUp(stats.totalSessions);
  const animHours    = useCountUp(Math.round(stats.totalMinutes / 60));
  const animStreak   = useCountUp(stats.streak);
  const giPct        = stats.totalMinutes > 0 ? Math.round((stats.giMinutes / stats.totalMinutes) * 100) : 0;
  const animGiPct    = useCountUp(giPct);

  // Find which column index contains today (for todayRowRef)
  const todayColIndex = useMemo(() => {
    if (new Date().getFullYear() !== year) return -1;
    return columns.findIndex(col => col.days.some(({ date }) => localDateKey(date) === today));
  }, [columns, today, year]);

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}
    >
      {/* ── Stats row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-5">
        {[
          { value: Math.round(animSessions), label: 'Sessions' },
          { value: Math.round(animHours),    label: 'Hours',   suffix: 'h' },
          { value: Math.round(animGiPct),    label: 'Gi',      suffix: '%' },
          { value: Math.round(animStreak),   label: 'Streak',  suffix: 'd' },
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

      {/* ── Vertical scroll container ─────────────────────────────── */}
      <style>{`.j2-compact-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={scrollRef}
        className="j2-compact-scroll"
        style={{
          overflowY: 'auto',
          scrollbarWidth: 'none',
          maxHeight: 'min(480px, 60dvh)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Sticky day-of-week header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: CELL_GAP,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            backgroundColor: CARD_BG,
            paddingBottom: 6,
            marginBottom: 2,
          }}
        >
          {DOW_LABELS.map(d => (
            <div
              key={d}
              style={{
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.30)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {columns.map((col, colIdx) => {
          const isToday = colIdx === todayColIndex;
          return (
            <div key={colIdx}>
              {/* Month section label */}
              {col.isMonthStart && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    paddingTop: colIdx === 0 ? 0 : 10,
                    paddingBottom: 4,
                    borderTop: colIdx === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    marginTop: colIdx === 0 ? 0 : 6,
                  }}
                >
                  {MONTH_ABBR[col.monthIndex]}
                </div>
              )}

              {/* Week row */}
              <div
                ref={isToday ? todayRowRef : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: CELL_GAP,
                  marginBottom: CELL_GAP,
                }}
              >
                {col.days.map(({ date, day }, dayIdx) => {
                  const key = localDateKey(date);
                  const inYear = date.getFullYear() === year;
                  const isFuture = key > today;
                  const isToday = key === today;
                  const bg = !inYear
                    ? 'rgba(13,24,18,0.18)'
                    : isFuture
                      ? '#10241A'
                      : cellColor(day);

                  return (
                    <div
                      key={`${colIdx}-${dayIdx}`}
                      style={{
                        aspectRatio: '1',
                        minWidth: 0,
                        borderRadius: 5,
                        backgroundColor: bg,
                        ...(isToday ? {
                          outline: '1.5px solid rgba(196,145,95,0.7)',
                          outlineOffset: -1,
                        } : {}),
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
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
