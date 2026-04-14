// CalendarHeatmap — 52-week rolling heatmap for the Calendar page desktop view.
// Larger cells than the home page widget. Clickable cells open the log form.
// Includes a stats summary row below the grid.

import { useMemo, useRef, useEffect } from 'react';
import { localDateKey, buildDayMap, cellColor, EMPTY_DAY, computeStats } from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import { PALE_YELLOW, SURFACE_2 } from '../lib/theme.ts';
import { SKILL_TAGS } from '../lib/constants.ts';

const WEEKS     = 52;
const CELL_SIZE = 16;   // px — slightly larger than the 14px home widget
const CELL_GAP  = 3;
const DAY_LABEL_W = 24; // px — width of the Mon/Wed/Fri label column

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS: { row: number; label: string }[] = [
  { row: 0, label: 'Mon' },
  { row: 2, label: 'Wed' },
  { row: 4, label: 'Fri' },
];

interface WeekSlice {
  days: { date: Date; day: DayData }[];
  monthIndex: number;
  isMonthStart: boolean;
}

function buildSlice(dayMap: Map<string, DayData>, year: number): WeekSlice[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const currentYear = now.getFullYear();

  // Anchor: if viewing current year, rightmost column includes today's week.
  // If viewing a past year, show Jan 1 – Dec 31 of that year.
  let endDate: Date;
  if (year === currentYear) {
    endDate = new Date(now);
  } else {
    endDate = new Date(year, 11, 31);
  }

  // Monday of the end week
  const dow = endDate.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const cursor = new Date(endDate);
  cursor.setDate(endDate.getDate() + toMonday - (WEEKS - 1) * 7);

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

// ── Stats computation ─────────────────────────────────────────────────────

function computeYearStats(sessions: SessionSummary[], year: number) {
  const yearSessions = sessions.filter(s => {
    const d = typeof s.date === 'string' ? s.date.slice(0, 4) : new Date(s.date).getFullYear().toString();
    return d === String(year);
  });

  const totalSessions = yearSessions.length;
  const totalMinutes = yearSessions.reduce((sum, s) => sum + s.duration, 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  // Most-trained pillar
  const tagCounts: Record<string, number> = {};
  yearSessions.forEach(s => s.tags?.forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; }));
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topPillar = topTag ? (SKILL_TAGS.find(s => s.value === topTag)?.label ?? topTag) : null;

  return { totalSessions, totalHours, topPillar };
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  sessions: SessionSummary[];
  year: number;
  onLogSession?: (dateKey: string) => void;
}

export default function CalendarHeatmap({ sessions, year, onLogSession }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayMap = useMemo(() => buildDayMap(sessions), [sessions]);
  const weeks = useMemo(() => buildSlice(dayMap, year), [dayMap, year]);
  const today = localDateKey(new Date());
  const { streakDays, streak } = useMemo(() => computeStats(sessions, year), [sessions, year]);
  const stats = useMemo(() => computeYearStats(sessions, year), [sessions, year]);

  // Auto-scroll to right edge so today / most recent data is visible
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [weeks]);

  const gridW = WEEKS * (CELL_SIZE + CELL_GAP) - CELL_GAP;

  return (
    <div className="space-y-5">
      {/* Scrollable heatmap */}
      <style>{`.j2-cal-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={scrollRef}
        className="j2-cal-scroll"
        style={{
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Day labels column */}
          <div
            style={{
              width: DAY_LABEL_W,
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 1,
              paddingTop: 18, // aligns with cell grid (below month labels)
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gap: CELL_GAP,
              }}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const label = DAY_LABELS.find(d => d.row === i);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 9,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.25)',
                    }}
                  >
                    {label?.label ?? ''}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid area */}
          <div>
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
                        fontSize: 10,
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

            {/* Cell grid — 7 rows × 52 cols */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gridAutoFlow: 'column',
                gap: CELL_GAP,
                width: gridW,
              }}
            >
              {weeks.flatMap((week, wIdx) =>
                week.days.map(({ date, day }, dIdx) => {
                  const key = localDateKey(date);
                  const isFuture = key > today;
                  const isToday = key === today;
                  const bg = isFuture ? '#10241A' : cellColor(day);
                  const isStreak = !isFuture && day.count > 0 && streakDays.has(key);

                  return (
                    <div
                      key={`${wIdx}-${dIdx}`}
                      className={isStreak ? 'j2-streak-cell' : undefined}
                      onClick={!isFuture && onLogSession ? () => onLogSession(key) : undefined}
                      title={`${key}${day.count > 0 ? ` — ${day.count} session${day.count > 1 ? 's' : ''}` : ''}`}
                      style={{
                        borderRadius: 3,
                        backgroundColor: bg,
                        cursor: !isFuture && onLogSession ? 'pointer' : 'default',
                        transition: 'transform 150ms ease',
                        ...(isToday ? {
                          outline: '1.5px solid rgba(196,145,95,0.7)',
                          outlineOffset: -1,
                        } : {}),
                      }}
                      onMouseEnter={e => { if (!isFuture) e.currentTarget.style.transform = 'scale(1.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Sessions', value: String(stats.totalSessions) },
          { label: 'Hours', value: stats.totalHours > 0 ? `${stats.totalHours}h` : '0h' },
          { label: 'Day streak', value: streak > 0 ? `${streak}d` : '—' },
          { label: 'Top focus', value: stats.topPillar ?? '—' },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl px-4 py-3 text-center"
            style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-lg font-bold" style={{ color: PALE_YELLOW }}>{value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.30)' }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
