import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  localDateKey, buildDayMap, cellColor, buildWeekRows, computeStats,
  EMPTY_DAY,
} from './TrainingHeatmap.tsx';
import type { DayData, WeekRow } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import SessionDetailModal from './SessionDetailModal.tsx';
import {
  PALE_YELLOW, GLOW_SOFT, COPPER, FONT_EDITORIAL,
  HEATMAP_HEADER_BG, INT_LABELS,
} from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';

const CELL = 32;
const GAP = 2;
const MONTH_COL = 32;
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface Props {
  sessions: SessionSummary[];
  year: number;
  loading?: boolean;
  onYearChange?: (year: number) => void;
  onLogSession?: (dateKey: string) => void;
  onSessionUpdated?: () => void;
}

export default function CalendarHeatmapView({
  sessions,
  year,
  loading = false,
  onYearChange,
  onLogSession,
  onSessionUpdated,
}: Props) {
  const dayMap = useMemo(() => buildDayMap(sessions), [sessions]);
  const { rows } = useMemo(() => buildWeekRows(dayMap, year), [dayMap, year]);
  const stats = useMemo(() => computeStats(sessions, year), [sessions, year]);
  const todayStr = localDateKey(new Date());

  const gridRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<HTMLDivElement[]>([]);
  const [selectedSession, setSelectedSession] = useState<{ session: SessionSummary; date: Date } | null>(null);

  // Long-press tooltip
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: Date; day: DayData } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  // Staggered fade-in on mount / year change
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cells = cellsRef.current;
    if (cells.length === 0) return;
    gsap.fromTo(cells,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, stagger: { each: 0.004, from: 'start' }, ease: 'power2.out' },
    );
  }, [year]);

  // Scroll to today on mount
  useEffect(() => {
    const el = gridRef.current?.querySelector('[data-today]');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [rows]);

  const handleCellTap = useCallback((date: Date, day: DayData) => {
    const key = localDateKey(date);
    if (day.count === 0) {
      onLogSession?.(key);
      return;
    }
    const session = sessions.find(s => {
      const sk = typeof s.date === 'string' ? s.date.slice(0, 10) : localDateKey(new Date(s.date));
      return sk === key;
    });
    if (session) setSelectedSession({ session, date });
  }, [sessions, onLogSession]);

  const handlePointerDown = useCallback((e: React.PointerEvent, date: Date, day: DayData) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = gridRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    longPressTimer.current = setTimeout(() => {
      setTooltip({
        x: rect.left - containerRect.left + CELL / 2,
        y: rect.top - containerRect.top - 8,
        date, day,
      });
    }, 500);
  }, []);

  const clearLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current);
    setTooltip(null);
  }, []);

  let cellIdx = 0;

  const totalHours = stats.totalMinutes / 60;

  return (
    <div>
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2
          style={{
            fontFamily: FONT_EDITORIAL,
            fontSize: 24,
            fontWeight: 500,
            color: PALE_YELLOW,
            textShadow: GLOW_SOFT,
            margin: 0,
          }}
        >
          Mat Time
        </h2>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', marginBottom: 12 }}>
        {[
          { value: stats.totalSessions, label: 'sessions' },
          { value: `${totalHours.toFixed(1)}h`, label: 'hours' },
          { value: `${stats.streak}d`, label: 'streak' },
        ].map(({ value, label }) => (
          <div key={label}>
            <span style={{ fontFamily: FONT_EDITORIAL, fontSize: 28, fontWeight: 500, color: COPPER }}>{value}</span>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Year navigator */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <button
          onClick={() => onYearChange?.(year - 1)}
          className="touch-manipulation"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4 }}
          aria-label="Previous year"
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.50)' }}>
          {year}
        </span>
        <button
          onClick={() => onYearChange?.(year + 1)}
          className="touch-manipulation"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4 }}
          aria-label="Next year"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Heatmap grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Training heatmap for ${year}`}
        style={{ position: 'relative', overflowY: 'auto', maxHeight: 'calc(100dvh - 280px)' }}
      >
        {/* Sticky day-of-week header */}
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: `${MONTH_COL}px repeat(7, ${CELL}px)`,
            gap: GAP,
            position: 'sticky',
            top: 0,
            zIndex: 20,
            backgroundColor: HEATMAP_HEADER_BG,
            paddingBottom: 4,
            paddingTop: 4,
          }}
        >
          <div />
          {DOW.map((d, i) => (
            <div
              key={i}
              role="columnheader"
              style={{
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.30)',
                letterSpacing: '0.05em',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {rows.map((row, ri) => {
          const isToday = row.days.some(d => localDateKey(d.date) === todayStr);
          return (
            <div key={ri}>
              {/* Month divider */}
              {row.isMonthStart && ri > 0 && (
                <div style={{ height: 1, backgroundColor: 'rgba(196,145,95,0.15)', marginLeft: MONTH_COL, marginTop: 6, marginBottom: 6 }} />
              )}
              <div
                role="row"
                {...(isToday ? { 'data-today': '' } : {})}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${MONTH_COL}px repeat(7, ${CELL}px)`,
                  gap: GAP,
                  alignItems: 'center',
                }}
              >
                {/* Month label */}
                <div style={{
                  fontFamily: FONT_EDITORIAL,
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'rgba(242,228,168,0.45)',
                  textAlign: 'right',
                  paddingRight: 6,
                }}>
                  {row.isMonthStart ? MONTH_ABBR[row.monthIndex] : ''}
                </div>

                {/* Day cells */}
                {row.days.map(({ date, day }) => {
                  const key = localDateKey(date);
                  const isThisToday = key === todayStr;
                  const hasSession = day.count > 0;
                  const bg = hasSession ? cellColor(day) : 'rgba(255,255,255,0.025)';
                  const isMaxIntensity = day.maxIntensity >= 5;
                  const idx = cellIdx++;
                  const intensityLabel = hasSession ? (INT_LABELS[day.maxIntensity] ?? '') : '';

                  return (
                    <div
                      key={key}
                      ref={el => { if (el) cellsRef.current[idx] = el; }}
                      role="gridcell"
                      aria-label={`${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${hasSession ? `, ${intensityLabel}, ${day.count} session${day.count !== 1 ? 's' : ''}` : ', no sessions'}`}
                      onClick={() => handleCellTap(date, day)}
                      onPointerDown={e => handlePointerDown(e, date, day)}
                      onPointerUp={clearLongPress}
                      onPointerCancel={clearLongPress}
                      onPointerLeave={clearLongPress}
                      className="touch-manipulation"
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 1,
                        backgroundColor: bg,
                        cursor: hasSession ? 'pointer' : 'default',
                        outline: isThisToday ? '1.5px solid rgba(242,228,168,0.7)' : 'none',
                        outlineOffset: isThisToday ? -1 : undefined,
                        boxShadow: isMaxIntensity && hasSession ? '0 0 8px rgba(196,145,95,0.4)' : 'none',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Long-press tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'rgba(21,46,34,0.95)',
            border: '1px solid rgba(196,145,95,0.35)',
            borderRadius: 10,
            padding: '8px 12px',
            zIndex: 30,
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
            minWidth: 120,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: PALE_YELLOW, marginBottom: 2 }}>
            {tooltip.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
          </div>
          {tooltip.day.count > 0 ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {INT_LABELS[tooltip.day.maxIntensity] ?? 'Session'} · {tooltip.day.count} session{tooltip.day.count !== 1 ? 's' : ''} · {formatDuration(tooltip.day.totalMinutes)}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>No sessions</div>
          )}
        </div>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession.session}
          date={selectedSession.date}
          onClose={() => setSelectedSession(null)}
          onSaved={() => { setSelectedSession(null); onSessionUpdated?.(); }}
          onDeleted={() => { setSelectedSession(null); onSessionUpdated?.(); }}
        />
      )}
    </div>
  );
}
