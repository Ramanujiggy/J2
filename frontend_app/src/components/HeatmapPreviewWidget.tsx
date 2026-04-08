// HeatmapPreviewWidget — ambient training-rhythm visualization for the home page.
// Read-only: no tap interactions on cells. "View calendar →" navigates to /calendar.
// Shows the rolling 10 weeks (70 days) ending today so today is always near the right edge.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDateKey, buildDayMap, cellColor, EMPTY_DAY } from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import { CARD_BG, COPPER, COPPER_BORDER, CARD_SHADOW } from '../lib/theme.ts';

const CELL_GAP = 4;
const WEEKS = 10;
const DAYS  = WEEKS * 7; // 70

interface WeekSlice {
  days: { date: Date; day: DayData }[];
}

function buildSlice(dayMap: Map<string, DayData>): WeekSlice[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Align to Monday of today's week as the last week's end
  const dow = today.getDay();
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() + daysToSunday);

  // Start = lastSunday - (WEEKS * 7 - 1) days, then align back to Monday
  const gridEnd = new Date(lastSunday);
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - (DAYS - 1));
  // Snap gridStart back to Monday
  const startDow = gridStart.getDay();
  const toMon = startDow === 0 ? -6 : 1 - startDow;
  gridStart.setDate(gridStart.getDate() + toMon);

  const weeks: WeekSlice[] = [];
  const cursor = new Date(gridStart);

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
    weeks.push({ days });
  }

  return weeks;
}

interface HeatmapPreviewWidgetProps {
  sessions: SessionSummary[];
}

export default function HeatmapPreviewWidget({ sessions }: HeatmapPreviewWidgetProps) {
  const navigate = useNavigate();
  const dayMap = useMemo(() => buildDayMap(sessions), [sessions]);
  const weeks  = useMemo(() => buildSlice(dayMap), [dayMap]);
  const today  = localDateKey(new Date());

  // Total cells rendered: WEEKS cols × 7 rows (grid-auto-flow: column)
  const cells = weeks.flatMap((week, wIdx) =>
    week.days.map(({ date, day }, dIdx) => {
      const key = localDateKey(date);
      const isFuture  = key > today;
      const isToday   = key === today;
      const bg = isFuture ? '#10241A' : cellColor(day);

      return (
        <div
          key={`${wIdx}-${dIdx}`}
          style={{
            borderRadius: 5,
            backgroundColor: bg,
            ...(isToday ? {
              outline: '2px solid rgba(196,145,95,0.8)',
              outlineOffset: -1,
              boxShadow: '0 0 8px 2px rgba(196,145,95,0.2)',
            } : {}),
          }}
        />
      );
    })
  );

  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.30)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Training Rhythm
        </span>
        <button
          onClick={() => navigate('/calendar')}
          className="touch-manipulation"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COPPER,
            letterSpacing: '-0.1px',
            padding: '4px 8px',
            margin: '-4px -8px',
          }}
        >
          View calendar →
        </button>
      </div>

      {/* Heatmap grid — 10 columns × 7 rows, no scroll */}
      <div
        style={{
          // Fade left and right edges for "abstract window" effect
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${WEEKS}, 1fr)`,
            gridTemplateRows: 'repeat(7, 1fr)',
            gridAutoFlow: 'column',
            gap: CELL_GAP,
            aspectRatio: `${WEEKS} / 7`,
          }}
        >
          {cells}
        </div>
      </div>
    </div>
  );
}
