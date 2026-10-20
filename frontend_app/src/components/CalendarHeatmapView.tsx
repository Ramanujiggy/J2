import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localDateKey, toDateKey, buildDayMap, cellColor, computeStats, EMPTY_DAY } from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary, BeltHistoryEntry } from '../types/api.ts';
import SessionDetailModal from './SessionDetailModal.tsx';
import { useBeltHistory } from '../hooks/useBeltHistory.ts';
import {
  PAGE_BG, PALE_YELLOW, GLOW_SOFT, COPPER, COPPER_BORDER, FONT_EDITORIAL, HEATMAP_HEADER_BG,
  INT_COLORS, INT_LABELS, SURFACE_2_BORDER, TEXT_BODY, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT,
} from '../lib/theme.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { formatDuration, INTENSITY_COLOR, SESSION_TYPE_LABELS, DAY_NAMES } from '../lib/sessionUtils.ts';

// Cells scale with the phone (≈25px on a 390px screen) so the week grid sits
// on the left and the rest of the row becomes a margin for month notes and
// promotions, the way a diary keeps a margin.
const CELL = 'clamp(18px, 6.4vw, 28px)';
const GAP = 3;
const MONTH_COL = 34;
const GRID_COLS = `${MONTH_COL}px repeat(7, ${CELL}) minmax(0, 1fr)`;

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LEGEND_STEPS = [1, 2, 3, 4, 5] as const;

// Invisible 44px tap area around a small control, without changing its layout.
const HIT_AREA = "relative before:absolute before:-inset-y-[10px] before:inset-x-0 before:content-['']";

interface Cell { date: Date; key: string; day: DayData }
interface WeekRow { month: number; isMonthStart: boolean; cells: (Cell | null)[] }

// One row per Monday-to-Sunday week, split at month boundaries so every day
// sits under its own month. Days outside the month are null (blank).
function buildMonthRows(dayMap: Map<string, DayData>, year: number): WeekRow[] {
  const rows: WeekRow[] = [];
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let cells: (Cell | null)[] = Array(7).fill(null);
    let isMonthStart = true;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const col = (date.getDay() + 6) % 7;
      const key = localDateKey(date);
      cells[col] = { date, key, day: dayMap.get(key) ?? EMPTY_DAY };
      if (col === 6 || d === daysInMonth) {
        rows.push({ month, isMonthStart, cells });
        cells = Array(7).fill(null);
        isMonthStart = false;
      }
    }
  }
  return rows;
}

function promotionLabel(p: BeltHistoryEntry): string {
  const belt = `${p.belt_rank.charAt(0).toUpperCase()}${p.belt_rank.slice(1)} belt`;
  return p.stripes > 0 ? `${belt}, ${p.stripes} stripe${p.stripes !== 1 ? 's' : ''}` : belt;
}

type Tooltip =
  | { kind: 'day'; x: number; y: number; date: Date; day: DayData }
  | { kind: 'promotion'; x: number; y: number; promotion: BeltHistoryEntry };

// What the inline list under the grid is showing: a whole month, or one day
// that holds more than one session.
type ListScope = { kind: 'month'; month: number } | { kind: 'day'; key: string };

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
  const rows = useMemo(() => buildMonthRows(dayMap, year), [dayMap, year]);
  const stats = useMemo(() => computeStats(sessions, year), [sessions, year]);
  const todayStr = localDateKey(new Date());

  const yearSessions = useMemo(
    () => sessions.filter(s => toDateKey(s.date).slice(0, 4) === String(year)),
    [sessions, year],
  );

  // Sessions and minutes per month, for the margin note on each month's first row
  const monthTotals = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => ({ count: 0, minutes: 0 }));
    for (const s of yearSessions) {
      const m = Number(toDateKey(s.date).slice(5, 7)) - 1;
      const t = totals[m];
      if (t) { t.count++; t.minutes += Number(s.duration) || 0; }
    }
    return totals;
  }, [yearSessions]);

  const { entries: beltHistory } = useBeltHistory();
  const promotionsByDay = useMemo(() => {
    const map = new Map<string, BeltHistoryEntry>();
    for (const entry of beltHistory) map.set(entry.promoted_at.slice(0, 10), entry);
    return map;
  }, [beltHistory]);

  // Dominant pillar for the stats row
  const dominantPillar = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of yearSessions) {
      const tag = s.tags?.[0];
      if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return SKILL_TAGS.find(t => t.value === top[0])?.label ?? top[0];
  }, [yearSessions]);

  const [listScope, setListScope] = useState<ListScope | null>(null);
  const sessionListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setListScope(null); }, [year]);

  const listSessions = useMemo(() => {
    if (listScope == null) return [];
    const prefix = listScope.kind === 'day'
      ? listScope.key
      : `${year}-${String(listScope.month + 1).padStart(2, '0')}`;
    return yearSessions
      .filter(s => toDateKey(s.date).startsWith(prefix))
      .sort((a, b) => toDateKey(b.date).localeCompare(toDateKey(a.date)));
  }, [yearSessions, year, listScope]);

  const listTitle = listScope == null ? '' : listScope.kind === 'day'
    ? new Date(listScope.key + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : `${MONTH_ABBR[listScope.month]} ${year}`;

  const toggleMonth = useCallback((month: number) => {
    setListScope(prev => (prev?.kind === 'month' && prev.month === month ? null : { kind: 'month', month }));
  }, []);

  // Scroll the session list into view when it opens
  useEffect(() => {
    if (listScope == null) return;
    const t = setTimeout(() => {
      sessionListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 320);
    return () => clearTimeout(t);
  }, [listScope]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<HTMLDivElement[]>([]);
  const [selectedSession, setSelectedSession] = useState<{ session: SessionSummary; date: Date } | null>(null);

  // Long-press tooltip (days) and tap tooltip (promotions)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const longPressFired = useRef(false);

  // Position a tooltip above an element, relative to the wrapper it renders in
  const anchorAbove = useCallback((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const w = wrapperRef.current?.getBoundingClientRect();
    if (!w) return null;
    return { x: r.left - w.left + r.width / 2, y: r.top - w.top - 8 };
  }, []);

  // A promotion tooltip stays until the next tap anywhere
  useEffect(() => {
    if (tooltip?.kind !== 'promotion') return;
    const close = () => setTooltip(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [tooltip]);

  // Staggered fade-in on mount / year change
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cells = cellsRef.current;
    if (cells.length === 0) return;
    gsap.fromTo(cells,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, stagger: { amount: 0.6, from: 'start' }, ease: 'power2.out' },
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

  const handleCellTap = useCallback((cell: Cell, isFuture: boolean) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (cell.day.count === 0) {
      if (!isFuture) onLogSession?.(cell.key);
      return;
    }
    const daySessions = yearSessions.filter(s => toDateKey(s.date) === cell.key);
    if (daySessions.length > 1) {
      setListScope({ kind: 'day', key: cell.key });
      return;
    }
    const session = daySessions[0];
    if (session) setSelectedSession({ session, date: cell.date });
  }, [yearSessions, onLogSession]);

  const handlePointerDown = useCallback((e: React.PointerEvent, cell: Cell) => {
    longPressFired.current = false;
    const el = e.currentTarget as HTMLElement;
    longPressTimer.current = setTimeout(() => {
      const pos = anchorAbove(el);
      if (!pos) return;
      longPressFired.current = true;
      setTooltip({ kind: 'day', ...pos, date: cell.date, day: cell.day });
    }, 500);
  }, [anchorAbove]);

  const clearLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current);
    setTooltip(t => (t?.kind === 'day' ? null : t));
  }, []);

  let cellIdx = 0;

  const totalHours = stats.totalMinutes / 60;
  const yearButtonStyle = {
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', color: TEXT_HINT, cursor: 'pointer', padding: 0,
  } as const;

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Header — title + year nav on one row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => onYearChange?.(year - 1)}
            className="touch-manipulation"
            style={yearButtonStyle}
            aria-label="Previous year"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: TEXT_TERTIARY, minWidth: 44, textAlign: 'center' as const }}>
            {year}
          </span>
          <button
            onClick={() => onYearChange?.(year + 1)}
            className="touch-manipulation"
            style={yearButtonStyle}
            aria-label="Next year"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats row — sessions, on the mat, most rolled */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', marginBottom: 12 }}>
        {[
          { value: stats.totalSessions, label: 'sessions' },
          { value: `${totalHours.toFixed(1)}h`, label: 'on the mat' },
          ...(dominantPillar ? [{ value: dominantPillar, label: 'most rolled' }] : []),
        ].map(({ value, label }) => (
          <div key={label}>
            <span style={{ fontFamily: FONT_EDITORIAL, fontSize: 28, fontWeight: 500, color: COPPER }}>{value}</span>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: TEXT_HINT, marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Legend — what the cell colours mean */}
      <div
        aria-label="Cell colour shows the hardest session that day"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginBottom: 12 }}
      >
        {LEGEND_STEPS.map(step => (
          <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: TEXT_TERTIARY }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: INT_COLORS[step] }} />
            {INT_LABELS[step]}
          </span>
        ))}
      </div>

      <style>{`.j2-heatmap-scroll::-webkit-scrollbar { display: none; }`}</style>
      {/* Heatmap grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`Training heatmap for ${year}`}
        className="j2-heatmap-scroll"
        style={{ position: 'relative', overflowY: 'auto', maxHeight: listScope != null ? 'calc(100dvh - 540px)' : 'calc(100dvh - 300px)', minHeight: 160, scrollbarWidth: 'none', transition: 'max-height 300ms ease' }}
      >
        {/* Sticky day-of-week header */}
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
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
                color: TEXT_HINT,
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
          const containsToday = row.cells.some(c => c?.key === todayStr);
          const promotion = row.cells.map(c => (c ? promotionsByDay.get(c.key) : undefined)).find(Boolean);
          const totals = monthTotals[row.month] ?? { count: 0, minutes: 0 };
          const monthHasData = totals.count > 0;
          const isMonthSelected = listScope?.kind === 'month' && listScope.month === row.month;
          return (
            <div key={ri}>
              {/* Month divider */}
              {row.isMonthStart && ri > 0 && (
                <div style={{ height: 1, backgroundColor: SURFACE_2_BORDER, marginTop: 8, marginBottom: 8 }} />
              )}
              <div
                role="row"
                {...(containsToday ? { 'data-today': '' } : {})}
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID_COLS,
                  gridAutoRows: CELL,
                  gap: GAP,
                  alignItems: 'center',
                  marginBottom: GAP,
                }}
              >
                {/* Month label — tappable to show that month's sessions */}
                {row.isMonthStart ? (
                  <button
                    onClick={() => monthHasData && toggleMonth(row.month)}
                    disabled={!monthHasData}
                    aria-expanded={isMonthSelected}
                    className={`touch-manipulation ${HIT_AREA}`}
                    style={{
                      fontFamily: FONT_EDITORIAL,
                      fontStyle: 'italic',
                      fontSize: 15,
                      color: isMonthSelected ? COPPER : monthHasData ? 'rgba(242,228,168,0.6)' : 'rgba(242,228,168,0.2)',
                      textAlign: 'left' as const,
                      background: 'none',
                      border: 'none',
                      cursor: monthHasData ? 'pointer' : 'default',
                      padding: 0,
                    }}
                  >
                    {MONTH_ABBR[row.month]}
                  </button>
                ) : <div />}

                {/* Day cells */}
                {row.cells.map((cell, ci) => {
                  if (!cell) return <div key={`blank-${ci}`} role="gridcell" aria-hidden="true" />;
                  const isFuture = cell.key > todayStr;
                  const isThisToday = cell.key === todayStr;
                  const hasSession = cell.day.count > 0;
                  const isMaxIntensity = cell.day.maxIntensity >= 5;
                  const idx = cellIdx++;
                  const intensityLabel = hasSession ? (INT_LABELS[cell.day.maxIntensity] ?? '') : '';
                  const tappable = hasSession || !isFuture;

                  return (
                    <div
                      key={cell.key}
                      ref={el => { if (el) cellsRef.current[idx] = el; }}
                      {...(hasSession ? { 'data-has-session': '' } : {})}
                      role="gridcell"
                      aria-label={`${cell.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${hasSession ? `, ${intensityLabel}, ${cell.day.count} session${cell.day.count !== 1 ? 's' : ''}` : ', no sessions'}`}
                      onClick={() => handleCellTap(cell, isFuture)}
                      onPointerDown={e => handlePointerDown(e, cell)}
                      onPointerUp={clearLongPress}
                      onPointerCancel={clearLongPress}
                      onPointerLeave={clearLongPress}
                      onContextMenu={e => e.preventDefault()}
                      className={`touch-manipulation${isThisToday ? ' animate-j2-today-pulse' : ''}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 2,
                        position: 'relative',
                        backgroundColor: hasSession ? cellColor(cell.day) : 'transparent',
                        // Rest days are a quiet outline, not a dark block
                        boxShadow: hasSession
                          ? (isMaxIntensity ? '0 0 10px rgba(196,145,95,0.5)' : 'none')
                          : `inset 0 0 0 1px ${isThisToday ? COPPER_BORDER : SURFACE_2_BORDER}`,
                        opacity: isFuture && !hasSession ? 0.45 : 1,
                        cursor: tappable ? 'pointer' : 'default',
                        outline: isThisToday ? `1.5px solid ${COPPER}` : 'none',
                        outlineOffset: isThisToday ? 1 : undefined,
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                      }}
                    >
                      {cell.day.count > 1 && (
                        <span
                          aria-hidden="true"
                          style={{ position: 'absolute', right: 2, top: 2, width: 4, height: 4, borderRadius: 1, backgroundColor: PAGE_BG, opacity: 0.55 }}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Margin — a promotion that week, else the month's totals on its first row */}
                <div style={{ minWidth: 0, paddingLeft: 8, display: 'flex', alignItems: 'center' }}>
                  {promotion ? (
                    <button
                      onClick={e => {
                        const pos = anchorAbove(e.currentTarget);
                        if (pos) setTooltip({ kind: 'promotion', ...pos, promotion });
                      }}
                      className={`touch-manipulation ${HIT_AREA}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%',
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      }}
                      aria-label={`${promotionLabel(promotion)}, ${new Date(promotion.promoted_at.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                    >
                      <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${COPPER}` }} />
                      <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 15, color: COPPER, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {promotionLabel(promotion)}
                      </span>
                    </button>
                  ) : row.isMonthStart && monthHasData ? (
                    <button
                      onClick={() => toggleMonth(row.month)}
                      aria-expanded={isMonthSelected}
                      className={`touch-manipulation ${HIT_AREA}`}
                      style={{
                        fontSize: 11, color: isMonthSelected ? COPPER : TEXT_TERTIARY, fontVariantNumeric: 'tabular-nums' as const,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' as const,
                      }}
                    >
                      {totals.count} session{totals.count !== 1 ? 's' : ''} · {formatDuration(totals.minutes)}
                      <ChevronRight size={11} style={{ display: 'inline', verticalAlign: '-1px', marginLeft: 2, transform: isMonthSelected ? 'rotate(90deg)' : 'none', transition: 'transform 200ms ease' }} />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {/* Bottom edge gradient — fades grid into page background */}
        <div style={{ position: 'sticky', bottom: 0, height: 40, background: `linear-gradient(to top, ${PAGE_BG} 0%, transparent 100%)`, pointerEvents: 'none', marginTop: -40 }} />
      </div>

      {/* Tooltip — long-press on a day, or tap on a promotion */}
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'rgba(21,46,34,0.95)',
            border: `1px solid ${COPPER_BORDER}`,
            borderRadius: 10,
            padding: '8px 12px',
            zIndex: 30,
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
            minWidth: 120,
            maxWidth: 240,
          }}
        >
          {tooltip.kind === 'day' ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: PALE_YELLOW, marginBottom: 2 }}>
                {tooltip.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
              </div>
              {tooltip.day.count > 0 ? (
                <div style={{ fontSize: 11, color: TEXT_TERTIARY }}>
                  {INT_LABELS[tooltip.day.maxIntensity] ?? 'Session'} · {tooltip.day.count} session{tooltip.day.count !== 1 ? 's' : ''} · {formatDuration(tooltip.day.totalMinutes)}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: TEXT_HINT, fontStyle: 'italic' }}>No sessions</div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 16, fontWeight: 500, color: PALE_YELLOW, marginBottom: 2 }}>
                {promotionLabel(tooltip.promotion)}
              </div>
              <div style={{ fontSize: 11, color: TEXT_TERTIARY }}>
                {new Date(tooltip.promotion.promoted_at.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              {tooltip.promotion.notes && (
                <div style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 1.35 }}>
                  {tooltip.promotion.notes}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Inline session list — a tapped month, or a day with several sessions */}
      {listScope != null && listSessions.length > 0 && (
        <div ref={sessionListRef} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: TEXT_HINT }}>
              {listTitle} · {listSessions.length} session{listSessions.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setListScope(null)}
              className="touch-manipulation"
              style={{ background: 'none', border: 'none', color: TEXT_HINT, fontSize: 11, cursor: 'pointer', minHeight: 44, padding: '0 4px' }}
            >
              Clear
            </button>
          </div>
          {listSessions.map(s => {
            const d = new Date(toDateKey(s.date) + 'T00:00:00');
            const intensity = Math.max(1, Math.min(5, s.intensity ?? 3));
            const intColor = INTENSITY_COLOR[intensity] ?? INT_COLORS[1];
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
                  minHeight: 44,
                  padding: '9px 4px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: 'transparent',
                  textAlign: 'left' as const,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12, color: TEXT_TERTIARY, fontVariantNumeric: 'tabular-nums' as const }}>
                  <strong style={{ color: TEXT_SECONDARY, fontWeight: 600 }}>{d.getDate()}</strong>
                  {' '}{DAY_NAMES[d.getDay()]}
                </span>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: intColor, boxShadow: `0 0 6px ${intColor}60` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {focusLabel}
                  <span style={{ fontWeight: 400, color: TEXT_HINT, fontSize: 11, marginLeft: 5 }}>· {typeLabel}</span>
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
