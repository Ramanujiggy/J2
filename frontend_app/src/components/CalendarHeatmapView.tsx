import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  localDateKey, buildDayMap, cellColor, buildWeekRows, computeStats,
} from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import SessionDetailModal from './SessionDetailModal.tsx';
import { useBeltHistory } from '../hooks/useBeltHistory.ts';
import {
  PAGE_BG, PALE_YELLOW, GLOW_SOFT, COPPER, FONT_EDITORIAL,
  HEATMAP_HEADER_BG, INT_LABELS,
} from '../lib/theme.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { formatDuration, INTENSITY_COLOR, SESSION_TYPE_LABELS, DAY_NAMES } from '../lib/sessionUtils.ts';

const CELL = 32;
const GAP = 2;
const MONTH_COL = 38;
const MARKER_COL = 36;

const BELT_RING_COLORS: Record<string, string> = {
  white:  'rgba(255,255,255,0.85)',
  blue:   '#4A90D9',
  purple: '#9B59B6',
  brown:  '#8B6914',
  black:  COPPER,
};
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
  onYearChange,
  onLogSession,
  onSessionUpdated,
}: Props) {
  const dayMap = useMemo(() => buildDayMap(sessions), [sessions]);
  const { rows } = useMemo(() => buildWeekRows(dayMap, year), [dayMap, year]);
  const stats = useMemo(() => computeStats(sessions, year), [sessions, year]);
  const todayStr = localDateKey(new Date());

  const { entries: beltHistory } = useBeltHistory();
  const promotionWeeks = useMemo(() => {
    const map = new Map<number, { belt_rank: string; stripes: number; promoted_at: string; notes: string | null }>();
    for (const entry of beltHistory) {
      const promoDate = entry.promoted_at.slice(0, 10);
      rows.forEach((row, i) => {
        if (row.days.some(d => localDateKey(d.date) === promoDate)) {
          map.set(i, { belt_rank: entry.belt_rank, stripes: entry.stripes, promoted_at: entry.promoted_at, notes: entry.notes });
        }
      });
    }
    return map;
  }, [beltHistory, rows]);

  // Dominant pillar for the stats row
  const dominantPillar = useMemo(() => {
    const yearSessions = sessions.filter(s => {
      const d = typeof s.date === 'string' ? s.date.slice(0, 4) : String(new Date(s.date).getFullYear());
      return d === String(year);
    });
    const counts: Record<string, number> = {};
    for (const s of yearSessions) {
      const tag = s.tags?.[0];
      if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return SKILL_TAGS.find(t => t.value === top[0])?.label ?? top[0];
  }, [sessions, year]);

  // Selected month for inline session list — null = show all year stats
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);

  const monthSessions = useMemo(() => {
    if (selectedMonth == null) return [];
    const prefix = `${year}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return sessions
      .filter(s => {
        const d = typeof s.date === 'string' ? s.date.slice(0, 10) : '';
        return d.startsWith(prefix);
      })
      .sort((a, b) => {
        const ak = typeof a.date === 'string' ? a.date.slice(0, 10) : '';
        const bk = typeof b.date === 'string' ? b.date.slice(0, 10) : '';
        return bk.localeCompare(ak);
      });
  }, [sessions, year, selectedMonth]);

  // Scroll session list into view when a month is selected
  useEffect(() => {
    if (selectedMonth != null && sessionListRef.current) {
      setTimeout(() => {
        sessionListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 320);
    }
  }, [selectedMonth]);

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

  // Scroll so today sits at ~80% of the viewport — past fills the screen,
  // future just peeks at the bottom. For past years, scroll to first data.
  useEffect(() => {
    const container = gridRef.current;
    if (!container) return;
    const todayEl = container.querySelector('[data-today]') as HTMLElement | null;
    if (todayEl) {
      const containerRect = container.getBoundingClientRect();
      const todayRect = todayEl.getBoundingClientRect();
      const targetScrollTop = todayRect.top - containerRect.top + container.scrollTop - containerRect.height * 0.8;
      container.scrollTop = Math.max(0, targetScrollTop);
      return;
    }
    const firstData = container.querySelector('[data-has-session]');
    if (firstData) firstData.scrollIntoView({ block: 'center', behavior: 'auto' });
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
      const scrollTop = gridRef.current?.scrollTop ?? 0;
      setTooltip({
        x: rect.left - containerRect.left + CELL / 2,
        y: rect.top - containerRect.top + scrollTop - 8,
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
      {/* Header — title + year nav on one row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { onYearChange?.(year - 1); setSelectedMonth(null); }}
            className="touch-manipulation"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4 }}
            aria-label="Previous year"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.50)', minWidth: 44, textAlign: 'center' as const }}>
            {year}
          </span>
          <button
            onClick={() => { onYearChange?.(year + 1); setSelectedMonth(null); }}
            className="touch-manipulation"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4 }}
            aria-label="Next year"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats row — sessions, on the mat, most rolled */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', marginBottom: 14 }}>
        {[
          { value: stats.totalSessions, label: 'sessions' },
          { value: `${totalHours.toFixed(1)}h`, label: 'on the mat' },
          ...(dominantPillar ? [{ value: dominantPillar, label: 'most rolled' }] : []),
        ].map(({ value, label }) => (
          <div key={label}>
            <span style={{ fontFamily: FONT_EDITORIAL, fontSize: 28, fontWeight: 500, color: COPPER }}>{value}</span>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <style>{`.j2-heatmap-scroll::-webkit-scrollbar { display: none; }`}</style>
      {/* Heatmap grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Training heatmap for ${year}`}
        className="j2-heatmap-scroll"
        style={{ position: 'relative', overflowY: 'auto', maxHeight: selectedMonth != null ? 'calc(100dvh - 520px)' : 'calc(100dvh - 280px)', scrollbarWidth: 'none', transition: 'max-height 300ms ease' }}
      >
        {/* Sticky day-of-week header */}
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: `${MONTH_COL}px repeat(7, ${CELL}px) ${MARKER_COL}px`,
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
          <div />
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
                data-row={ri}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${MONTH_COL}px repeat(7, ${CELL}px) ${MARKER_COL}px`,
                  gridAutoRows: CELL,
                  gap: GAP,
                  alignItems: 'center',
                }}
              >
                {/* Month label — tappable to show session list for that month */}
                {(() => {
                  if (!row.isMonthStart) return <div />;
                  const monthHasData = rows
                    .filter(r => r.monthIndex === row.monthIndex)
                    .some(r => r.days.some(d => d.day.count > 0));
                  const isSelected = selectedMonth === row.monthIndex;
                  return (
                    <button
                      onClick={() => setSelectedMonth(isSelected ? null : row.monthIndex)}
                      className="touch-manipulation"
                      style={{
                        fontFamily: FONT_EDITORIAL,
                        fontStyle: 'italic',
                        fontSize: monthHasData ? 15 : 11,
                        color: isSelected ? COPPER : monthHasData ? 'rgba(242,228,168,0.55)' : 'rgba(242,228,168,0.18)',
                        textAlign: 'right' as const,
                        paddingRight: 6,
                        background: 'none',
                        border: 'none',
                        cursor: monthHasData ? 'pointer' : 'default',
                        padding: 0,
                        paddingRight: 6,
                      }}
                    >
                      {MONTH_ABBR[row.monthIndex]}
                    </button>
                  );
                })()}

                {/* Day cells */}
                {row.days.map(({ date, day }) => {
                  const key = localDateKey(date);
                  const isFuture = key > todayStr;
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
                      {...(hasSession ? { 'data-has-session': '' } : {})}
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
                        borderRadius: 2,
                        backgroundColor: bg,
                        opacity: isFuture ? 0.35 : 1,
                        cursor: hasSession ? 'pointer' : 'default',
                        outline: isThisToday ? '1.5px solid rgba(242,228,168,0.7)' : 'none',
                        outlineOffset: isThisToday ? -1 : undefined,
                        boxShadow: isMaxIntensity && hasSession ? '0 0 10px rgba(196,145,95,0.5)' : 'none',
                      }}
                    />
                  );
                })}

                {/* Marker column — promotion rings */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {promotionWeeks.has(ri) && (() => {
                    const promo = promotionWeeks.get(ri)!;
                    const ringColor = BELT_RING_COLORS[promo.belt_rank] ?? COPPER;
                    return (
                      <button
                        className="touch-manipulation"
                        onClick={() => {
                          setTooltip({
                            x: (MONTH_COL + 7 * (CELL + GAP) + MARKER_COL / 2),
                            y: (gridRef.current?.querySelector(`[data-row="${ri}"]`) as HTMLElement)?.offsetTop ?? 0,
                            date: new Date(promo.promoted_at + 'T00:00:00'),
                            day: { count: 0, totalMinutes: 0, maxIntensity: 0, notes: promo.notes ? [promo.notes] : [] },
                          });
                        }}
                        style={{
                          width: 10, height: 10,
                          borderRadius: '50%',
                          border: `1.5px solid ${ringColor}`,
                          backgroundColor: 'transparent',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                        aria-label={`Promoted to ${promo.belt_rank} belt${promo.stripes > 0 ? `, ${promo.stripes} stripe${promo.stripes !== 1 ? 's' : ''}` : ''}`}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}

        {/* Bottom edge gradient — fades grid into page background */}
        <div style={{ position: 'sticky', bottom: 0, height: 40, background: `linear-gradient(to top, ${PAGE_BG} 0%, transparent 100%)`, pointerEvents: 'none', marginTop: -40 }} />
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

      {/* Inline session list — shows when a month is tapped */}
      {selectedMonth != null && monthSessions.length > 0 && (
        <div ref={sessionListRef} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>
              {MONTH_ABBR[selectedMonth]} {year} · {monthSessions.length} session{monthSessions.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedMonth(null)}
              className="touch-manipulation"
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
          {monthSessions.map(s => {
            const dateStr = typeof s.date === 'string' ? s.date.slice(0, 10) : '';
            const d = new Date(dateStr + 'T00:00:00');
            const intensity = Math.max(1, Math.min(5, s.intensity ?? 3));
            const intColor = INTENSITY_COLOR[intensity] ?? '#5E8A5C';
            const primary = s.tags?.[0];
            const focusLabel = primary ? (SKILL_TAGS.find(t => t.value === primary)?.label ?? primary) : 'Open rolling';
            const typeLabel = SESSION_TYPE_LABELS[s.session_type] ?? s.session_type;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSession({ session: s, date: d })}
                className="touch-manipulation"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 9px 1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  width: '100%',
                  padding: '9px 4px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: 'transparent',
                  textAlign: 'left' as const,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' as const }}>
                  <strong style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{d.getDate()}</strong>
                  {' '}{DAY_NAMES[d.getDay()]}
                </span>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: intColor, boxShadow: `0 0 6px ${intColor}60` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {focusLabel}
                  <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.28)', fontSize: 11, marginLeft: 5 }}>· {typeLabel}</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: COPPER, fontVariantNumeric: 'tabular-nums' as const }}>
                  {formatDuration(s.duration ?? 0)}
                </span>
              </button>
            );
          })}
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
