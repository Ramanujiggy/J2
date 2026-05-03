// HeatmapPreviewWidget — operational training-rhythm card for the home page
// (Path Ahead). Re-scoped from a 24-week reflective view to a focused
// last-30-days ribbon: Path Ahead is week-and-narrower; the year-shaped
// reflection lives on Atlas → Prism. Today is always in the rightmost column.
//
// Purely visual — no per-cell interactions. Tap anywhere → /calendar.

import { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDateKey, buildDayMap, cellColor, EMPTY_DAY, computeStats } from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import { CARD_BG, COPPER, CARD_GLOW, CARD_GLOW_BORDER } from '../lib/theme.ts';

// 5 weeks (35 days) covers the last 30 days plus a few extra columns at the
// left so the most recent month doesn't end mid-week. Keeps the familiar
// 7-row × N-col grid format readers already know from CompactHeatmap, just
// drastically shorter.
const WEEKS     = 5;
const CELL_SIZE = 16;   // px — slightly larger than the old 14px since fewer columns means more room
const CELL_GAP  = 3;    // px

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface WeekSlice {
  days: { date: Date; day: DayData }[];
  monthIndex: number;
  isMonthStart: boolean;
}

function buildSlice(dayMap: Map<string, DayData>): WeekSlice[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Monday of today's week
  const dow = today.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const cursor = new Date(today);
  cursor.setDate(today.getDate() + toMonday - (WEEKS - 1) * 7);

  const weeks: WeekSlice[] = [];
  let lastMonth = -1;

  for (let w = 0; w < WEEKS; w++) {
    const days: WeekSlice['days'] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      days.push({
        date,
        day: dayMap.get(localDateKey(date)) ?? { ...EMPTY_DAY, notes: [] },
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    const monthIndex = days[0]!.date.getMonth();
    const isMonthStart = monthIndex !== lastMonth;
    if (isMonthStart) lastMonth = monthIndex;
    weeks.push({ days, monthIndex, isMonthStart });
  }

  return weeks;
}

interface HeatmapPreviewWidgetProps {
  sessions: SessionSummary[];
}

export default function HeatmapPreviewWidget({ sessions }: HeatmapPreviewWidgetProps) {
  const navigate  = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayMap     = useMemo(() => buildDayMap(sessions), [sessions]);
  const weeks      = useMemo(() => buildSlice(dayMap), [dayMap]);
  const today      = localDateKey(new Date());
  const { streakDays } = useMemo(() => computeStats(sessions, new Date().getFullYear()), [sessions]);

  // Auto-scroll to right edge so today's column is visible on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [weeks]);

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        cursor: 'pointer',
      }}
      onClick={() => navigate('/calendar')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.30)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Last 30 days
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COPPER,
            letterSpacing: '-0.1px',
          }}
        >
          View calendar →
        </span>
      </div>

      {/* Scrollable heatmap */}
      <style>{`.j2-widget-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={scrollRef}
        className="j2-widget-scroll"
        style={{
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Month labels row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
            gap: CELL_GAP,
            marginBottom: 4,
          }}
        >
          {weeks.map((col, i) => (
            <div key={i} style={{ minWidth: 0 }}>
              {col.isMonthStart && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.35)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {MONTH_ABBR[col.monthIndex]}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Cell grid — 7 rows × WEEKS cols */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
            gridAutoFlow: 'column',
            gap: CELL_GAP,
          }}
        >
          {weeks.flatMap((week, wIdx) =>
            week.days.map(({ date, day }, dIdx) => {
              const key      = localDateKey(date);
              const isFuture = key > today;
              const isToday  = key === today;
              const bg = isFuture ? '#10241A' : cellColor(day);

              const isStreak = !isFuture && day.count > 0 && streakDays.has(key);

              return (
                <div
                  key={`${wIdx}-${dIdx}`}
                  className={isStreak ? 'j2-streak-cell' : undefined}
                  style={{
                    borderRadius: 3,
                    backgroundColor: bg,
                    ...(isToday ? {
                      outline: '1.5px solid rgba(196,145,95,0.7)',
                      outlineOffset: -1,
                    } : {}),
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
