// AtlasPrismDeck — merged Atlas/Analytics view container.
//
// Adapted from SkillRadar.tsx (which it will replace once /analytics retires).
// Differences from the original:
//   • Prism sub-view renders BigPrism (560×560 editorial pentagon) instead of
//     the small RadarChart. BigPrism handles its own animation transitions.
//   • selectedTag is lifted through props so the parent (Atlas PrismPanel)
//     can show a vertex-specific stat row below the deck.
//   • timeWindow + customRange are also lifted to the parent so they persist
//     across sub-tab switches and pair with the page-level hero stats.
//   • Drum slide animation simplified to opacity fade — the editorial frame
//     deserves a calmer transition than SkillRadar's clinical slide.

import { useState, useEffect, useMemo, useRef } from 'react';
import { Info, Triangle, Target, BarChart2, Layers, BookOpen, Activity, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { SKILL_TAGS, MONTH_NAMES } from '../../lib/constants.ts';
import { CARD_BG, COPPER, CARD_GLOW, CARD_GLOW_BORDER, PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_3_BORDER } from '../../lib/theme.ts';
import { WINDOW_DAYS, type TimeWindow, sessionPillarHours } from '../../lib/analyticsUtils.ts';
import type { SessionSummary } from '../TrainingHeatmap.tsx';
import TimeRangeBar from '../TimeRangeBar.tsx';
import { SKILL_COLORS, DEFAULT_COLORS } from '../charts/RadarChart.tsx';
import DonutChart from '../charts/DonutChart.tsx';
import VolumeChart, { sessionMonth } from '../charts/VolumeChart.tsx';
import WeeklyChart from '../charts/WeeklyChart.tsx';
import { computeEntropy } from '../../lib/analyticsModels.ts';
import BigPrism from './BigPrism.tsx';

const SEG_GI    = 'rgba(82,181,108,0.80)';
const SEG_NOGI  = 'rgba(218,116,34,0.80)';
const SEG_CLASS = 'rgba(82,181,108,0.80)';
const SEG_DRILL = 'rgba(242,228,168,0.65)';
const SEG_COMP  = 'rgba(220,90,80,0.80)';

export type ViewMode = 'prism' | 'volume' | 'split' | 'format' | 'weekly';

const RAIL_VIEWS: { id: ViewMode; label: string; short: string; Icon: LucideIcon }[] = [
  { id: 'prism',  label: 'Grappling Prism',  short: 'Prism',  Icon: Target    },
  { id: 'volume', label: 'Volume by Month',   short: 'Volume', Icon: BarChart2 },
  { id: 'split',  label: 'The Two Worlds',    short: 'Split',  Icon: Layers    },
  { id: 'format', label: 'Session Format',    short: 'Format', Icon: BookOpen  },
  { id: 'weekly', label: 'Weekly Rhythm',     short: 'Weekly', Icon: Activity  },
];

const VIEW_META: Record<ViewMode, { title: string; subtitle: string }> = {
  prism: {
    title: 'The Grappling Prism',
    subtitle: 'Your training is a single source of effort that refracts into five distinct pillars of mastery. The Grappling Prism visualizes the balance of your mat time, revealing the unique spectrum of your game.',
  },
  volume: {
    title: 'Volume by Month',
    subtitle: 'Hours Logged — track your consistency and pinpoint exactly when your momentum peaks or dips.',
  },
  split: {
    title: 'The Two Worlds',
    subtitle: 'Gi vs. No-Gi — a clear division of your mat time between the traditional kimono and the submission grappling ruleset.',
  },
  format: {
    title: 'Session Format',
    subtitle: 'A breakdown of your labor across structured classes, focused drilling, and live competition.',
  },
  weekly: {
    title: 'Weekly Rhythm',
    subtitle: 'Hours per week across the past 52 weeks — see the cadence of your training at a glance.',
  },
};

interface Props {
  sessions: SessionSummary[];
  timeWindow: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
  customRange: { start: string; end: string } | null;
  onCustomRangeChange: (r: { start: string; end: string } | null) => void;
  /** Lifted up so the parent can render a vertex-specific stats row beneath the deck. */
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  /** Desktop renders a larger BigPrism; mobile (Phase 2) renders compact. */
  bigPrismSize?: number;
}

export default function AtlasPrismDeck({
  sessions, timeWindow, onWindowChange, customRange, onCustomRangeChange,
  selectedTag, onSelectTag, bigPrismSize = 480,
}: Props) {
  const [subtitleRevealed, setSubtitleRevealed] = useState(false);
  const [displayMode, setDisplayMode] = useState<'hours' | 'pct'>('hours');
  const [viewMode, setViewMode] = useState<ViewMode>('prism');
  const weeklyScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll weekly chart to current week
  useEffect(() => {
    if (viewMode !== 'weekly') return;
    const el = weeklyScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' });
  }, [viewMode]);

  // Mobile auto-reveal subtitle on view change
  useEffect(() => {
    const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouchOnly) {
      setSubtitleRevealed(false);
      return;
    }
    setSubtitleRevealed(false);
    const t = setTimeout(() => setSubtitleRevealed(true), 1200);
    return () => clearTimeout(t);
  }, [viewMode]);

  // ── Filtered sessions ──
  const filtered = useMemo(() => {
    if (timeWindow === 'custom' && customRange) {
      const start = new Date(customRange.start + 'T00:00:00');
      const end   = new Date(customRange.end   + 'T23:59:59');
      return sessions.filter(s => {
        const d = new Date(s.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    }
    const days = WINDOW_DAYS[timeWindow];
    const cutoff = days != null ? new Date(Date.now() - days * 86_400_000) : null;
    return cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;
  }, [sessions, timeWindow, customRange]);

  // ── Prior period (for delta stats) ──
  const priorFiltered = useMemo(() => {
    if (timeWindow === 'custom') return null;
    const days = WINDOW_DAYS[timeWindow];
    if (!days) return null;
    const cutoff      = new Date(Date.now() - days * 86_400_000);
    const priorCutoff = new Date(Date.now() - days * 2 * 86_400_000);
    return sessions.filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= priorCutoff && d < cutoff;
    });
  }, [sessions, timeWindow]);

  // ── Prism data ──
  const hoursMap: Record<string, number> = Object.fromEntries(SKILL_TAGS.map(({ value }) => [value, 0]));
  for (const s of filtered) {
    const ph = sessionPillarHours(s);
    for (const [k, v] of Object.entries(ph)) {
      if (k in hoursMap) hoursMap[k] += v;
    }
  }
  const hours            = SKILL_TAGS.map(({ value }) => hoursMap[value]);
  const maxHours         = Math.max(...hours, 0.001);
  const normalized       = hours.map(h => h / maxHours);
  const totalTaggedHours = hours.reduce((a, b) => a + b, 0);
  const hasData          = hours.some(h => h > 0);
  const dominantIndex    = hours.indexOf(Math.max(...hours));

  // ── Split / Format / Volume / Weekly stats ──
  const giHours    = filtered.filter(s => s.gi_nogi === 'gi').reduce((sum, s) => sum + s.duration / 60, 0);
  const nogiHours  = filtered.filter(s => s.gi_nogi === 'no_gi').reduce((sum, s) => sum + s.duration / 60, 0);
  const splitTotal = giHours + nogiHours;

  const classHours  = filtered.filter(s => s.session_type === 'class').reduce((sum, s) => sum + s.duration / 60, 0);
  const drillHours  = filtered.filter(s => s.session_type === 'drilling').reduce((sum, s) => sum + s.duration / 60, 0);
  const compHours   = filtered.filter(s => s.session_type === 'competition_training').reduce((sum, s) => sum + s.duration / 60, 0);
  const formatTotal = classHours + drillHours + compHours;

  const monthlyHoursArr = Array(12).fill(0) as number[];
  for (const s of filtered) {
    const m = sessionMonth(s.date);
    if (!isNaN(m)) monthlyHoursArr[m] += s.duration / 60;
  }
  const totalVolHours = monthlyHoursArr.reduce((a, b) => a + b, 0);
  const peakMonthIdx  = monthlyHoursArr.indexOf(Math.max(...monthlyHoursArr));
  const trainedMonths = monthlyHoursArr.filter(h => h > 0).length;
  const avgPerMonth   = trainedMonths > 0 ? totalVolHours / trainedMonths : 0;

  const weeklyData = useMemo(() => {
    const monday = (d: Date) => {
      const c = new Date(d);
      const dow = c.getDay();
      c.setDate(c.getDate() - (dow === 0 ? 6 : dow - 1));
      c.setHours(0, 0, 0, 0);
      return c;
    };
    const thisMonday = monday(new Date());
    const all = Array.from({ length: 52 }, (_, i) => {
      const weekStart = new Date(thisMonday);
      weekStart.setDate(weekStart.getDate() - (51 - i) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekSessions = filtered.filter(s => {
        const d = new Date(s.date);
        return d >= weekStart && d <= weekEnd;
      });
      return {
        weekStart,
        hours: weekSessions.reduce((sum, s) => sum + s.duration / 60, 0),
        count: weekSessions.length,
        isCurrent: i === 51,
      };
    });
    const firstNonEmpty = all.findIndex(w => w.hours > 0);
    if (firstNonEmpty <= 0) return all;
    return all.slice(firstNonEmpty);
  }, [filtered]);

  const totalWeeklyHours = weeklyData.reduce((s, w) => s + w.hours, 0);
  const activeWeeks      = weeklyData.filter(w => w.hours > 0).length;
  const peakWeek         = weeklyData.reduce((best, w) => w.hours > best.hours ? w : best, weeklyData[0]);
  const avgWeeklyHours   = activeWeeks > 0 ? totalWeeklyHours / activeWeeks : 0;

  // ── Prior period stats ──
  const priorVolHours    = priorFiltered?.reduce((sum, s) => sum + s.duration / 60, 0) ?? null;
  const priorSplitTotal  = priorFiltered
    ? priorFiltered.filter(s => s.gi_nogi === 'gi' || s.gi_nogi === 'no_gi').reduce((sum, s) => sum + s.duration / 60, 0)
    : null;
  const priorFormatTotal = priorFiltered
    ? priorFiltered.filter(s => ['class','drilling','competition_training'].includes(s.session_type)).reduce((sum, s) => sum + s.duration / 60, 0)
    : null;

  function delta(current: number, prior: number | null): string | null {
    if (prior === null || prior < 0.01) return null;
    const p = Math.round(((current - prior) / prior) * 100);
    return (p >= 0 ? '↑' : '↓') + Math.abs(p) + '%';
  }

  // ── Pre-computed prism rows ──
  const prismRows = SKILL_TAGS.map(({ label, value }, i) => ({
    label,
    value,
    h:          hours[i],
    total:      totalTaggedHours,
    color:      (SKILL_COLORS[value]?.dot ?? DEFAULT_COLORS.dot) as string,
    isDominant: hasData && i === dominantIndex,
  }));

  function fmtVal(h: number, total: number): string {
    if (h <= 0) return '—';
    return displayMode === 'hours'
      ? `${h.toFixed(1)}h`
      : `${total > 0 ? ((h / total) * 100).toFixed(0) : 0}%`;
  }

  const BAR_MAX_PX = 80;

  // ── Chart renderer ──
  function renderChart(mode: ViewMode) {
    if (mode === 'volume') return <VolumeChart sessions={filtered} />;
    if (mode === 'weekly') return (
      <div className="relative">
        <div
          ref={weeklyScrollRef}
          data-no-page-swipe=""
          className="j2-weekly-scroll"
          style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <style>{`.j2-weekly-scroll::-webkit-scrollbar { display: none; }`}</style>
          <WeeklyChart weeks={weeklyData} />
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6" style={{ background: `linear-gradient(to right, ${CARD_BG}, transparent)` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6" style={{ background: `linear-gradient(to left, ${CARD_BG}, transparent)` }} />
      </div>
    );
    if (mode === 'split') return (
      <div className="flex justify-center">
        <div style={{ width: '100%', maxWidth: 280, aspectRatio: '1' }}>
          <DonutChart
            segments={[
              { value: giHours,   color: SEG_GI,  label: 'Gi'    },
              { value: nogiHours, color: SEG_NOGI, label: 'No-Gi' },
            ]}
            centerLabel={splitTotal > 0 ? `${Math.round((giHours / splitTotal) * 100)}%` : '—'}
            centerSub="Gi"
          />
        </div>
      </div>
    );
    if (mode === 'format') return (
      <div className="flex justify-center">
        <div style={{ width: '100%', maxWidth: 280, aspectRatio: '1' }}>
          <DonutChart
            segments={[
              { value: classHours, color: SEG_CLASS, label: 'Class'       },
              { value: drillHours, color: SEG_DRILL, label: 'Drilling'    },
              { value: compHours,  color: SEG_COMP,  label: 'Competition' },
            ]}
            centerLabel={formatTotal > 0 ? `${formatTotal.toFixed(0)}h` : '—'}
            centerSub="total"
          />
        </div>
      </div>
    );
    // prism — Atlas's BigPrism
    return (
      <BigPrism
        normalized={normalized}
        activeTag={selectedTag}
        onSelect={onSelectTag}
        size={bigPrismSize}
      />
    );
  }

  // ── Breakdown / stats renderer ──
  function renderBreakdownContent(mode: ViewMode) {
    if (mode === 'volume') {
      return (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Total',    value: totalVolHours > 0 ? `${totalVolHours.toFixed(1)}h` : '—', active: totalVolHours > 0, d: delta(totalVolHours, priorVolHours) },
            { label: 'Peak',     value: totalVolHours > 0 ? MONTH_NAMES[peakMonthIdx]        : '—', active: totalVolHours > 0 },
            { label: 'Avg / mo', value: avgPerMonth   > 0 ? `${avgPerMonth.toFixed(1)}h`     : '—', active: avgPerMonth   > 0 },
          ].map(({ label, value, active, d }) => (
            <div key={label} className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-bold" style={{ color: PALE_YELLOW }}>{label}</span>
              <span className="text-xs" style={{ color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="text-2xl font-bold" style={{
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.15)',
                textShadow: active ? GLOW_SOFT : 'none',
              }}>{value}</span>
              {d && <span style={{ fontSize: 11, fontWeight: 600, alignSelf: 'center', color: d.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)' }}>{d}</span>}
            </div>
          ))}
        </div>
      );
    }
    if (mode === 'weekly') {
      return (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Total',    value: totalWeeklyHours > 0 ? `${totalWeeklyHours.toFixed(1)}h` : '—', active: totalWeeklyHours > 0 },
            { label: 'Active',   value: activeWeeks > 0 ? `${activeWeeks} of 52 wks` : '—',             active: activeWeeks > 0 },
            { label: 'Peak',     value: peakWeek.hours > 0 ? `${peakWeek.hours.toFixed(1)}h` : '—',    active: peakWeek.hours > 0 },
            { label: 'Avg/week', value: avgWeeklyHours > 0 ? `${avgWeeklyHours.toFixed(1)}h` : '—',    active: avgWeeklyHours > 0 },
          ].map(({ label, value, active }) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className="text-xs font-bold" style={{ color: PALE_YELLOW }}>{label}</span>
              <span className="text-xs" style={{ color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="text-2xl font-bold" style={{
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.15)',
                textShadow: active ? GLOW_SOFT : 'none',
              }}>{value}</span>
            </div>
          ))}
        </div>
      );
    }
    if (mode === 'split') {
      return (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Total',  value: splitTotal > 0 ? `${splitTotal.toFixed(1)}h` : '—',                 active: splitTotal > 0,  d: delta(splitTotal,  priorSplitTotal) },
            { label: 'Gi',     value: giHours   > 0 ? fmtVal(giHours,   splitTotal) : '—', active: giHours   > 0 },
            { label: 'No-Gi',  value: nogiHours > 0 ? fmtVal(nogiHours, splitTotal) : '—', active: nogiHours > 0 },
          ].map(({ label, value, active, d }) => (
            <div key={label} className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-bold" style={{ color: PALE_YELLOW }}>{label}</span>
              <span className="text-xs" style={{ color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="text-2xl font-bold" style={{
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.15)',
                textShadow: active ? GLOW_SOFT : 'none',
              }}>{value}</span>
              {d && <span style={{ fontSize: 11, fontWeight: 600, alignSelf: 'center', color: d.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)' }}>{d}</span>}
            </div>
          ))}
        </div>
      );
    }
    if (mode === 'format') {
      return (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Total',  value: formatTotal > 0 ? `${formatTotal.toFixed(1)}h` : '—',              active: formatTotal > 0, d: delta(formatTotal, priorFormatTotal) },
            { label: 'Class',  value: classHours > 0 ? fmtVal(classHours, formatTotal) : '—', active: classHours > 0 },
            { label: 'Drill',  value: drillHours > 0 ? fmtVal(drillHours, formatTotal) : '—', active: drillHours > 0 },
            { label: 'Comp',   value: compHours  > 0 ? fmtVal(compHours,  formatTotal) : '—', active: compHours  > 0 },
          ].map(({ label, value, active, d }) => (
            <div key={label} className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs font-bold" style={{ color: PALE_YELLOW }}>{label}</span>
              <span className="text-xs" style={{ color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="text-2xl font-bold" style={{
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.15)',
                textShadow: active ? GLOW_SOFT : 'none',
              }}>{value}</span>
              {d && <span style={{ fontSize: 11, fontWeight: 600, alignSelf: 'center', color: d.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)' }}>{d}</span>}
            </div>
          ))}
        </div>
      );
    }
    // prism — hours-bar legend + diversity score
    const rows = prismRows;
    const maxRowH = Math.max(...rows.map(r => r.h), 0.001);
    return (
      <div className="space-y-3">
        {rows.map(({ label, h, total, color, isDominant }) => {
          const barW = displayMode === 'hours'
            ? (h > 0 ? Math.max((h / maxRowH) * BAR_MAX_PX, 6) : 2)
            : 1.5;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div
                  className="flex-shrink-0"
                  style={{
                    width: 8, height: 8, borderRadius: 2,
                    backgroundColor: h > 0 ? color : 'rgba(255,255,255,0.12)',
                  }}
                />
                <span
                  className="text-xs font-bold"
                  style={{ color: isDominant ? color : PALE_YELLOW }}
                >
                  {label}{isDominant && h > 0 ? ' ★' : ''}
                </span>
              </div>
              <div
                className="flex-shrink-0"
                style={{
                  width:  `${barW}px`,
                  height: displayMode === 'hours' ? '5px' : '13px',
                  backgroundColor: h > 0
                    ? (displayMode === 'hours' ? color.replace(/[\d.]+\)$/, '0.45)') : 'rgba(242,228,168,0.25)')
                    : 'rgba(255,255,255,0.1)',
                  borderRadius: displayMode === 'hours' ? '2.5px' : '1px',
                  transition: 'width 450ms cubic-bezier(0.4,0,0.2,1), height 300ms ease, border-radius 300ms ease',
                }}
              />
              <span className="text-sm font-bold" style={{
                color: h > 0 ? PALE_YELLOW : 'rgba(255,255,255,0.2)',
                textShadow: h > 0 ? GLOW_SOFT : 'none',
              }}>
                {fmtVal(h, total)}
              </span>
            </div>
          );
        })}
        {rows.every(r => r.h === 0) && (
          <p className="text-xs text-white/25 italic pt-1">No tagged sessions in this window.</p>
        )}
        {(() => {
          const entropy = computeEntropy(hoursMap);
          if (entropy.score === null) return null;
          return (
            <div className="flex items-baseline gap-2 pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-xs font-bold" style={{ color: PALE_YELLOW }}>Diversity</span>
              <span className="text-xs" style={{ color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="text-sm font-bold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                {entropy.score.toFixed(2)}
              </span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {entropy.label}
              </span>
            </div>
          );
        })()}
      </div>
    );
  }

  const isVolumeType = viewMode === 'volume' || viewMode === 'weekly';

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW }}>

      {/* Title */}
      <div className="flex items-center gap-1.5 mb-2">
        <h2 className="text-lg font-semibold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
          {VIEW_META[viewMode].title}
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-white/40 hover:text-white/70 transition-colors leading-none">
              <Info size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-semibold mb-1">How it Works</p>
            <p className="text-xs leading-relaxed text-popover-foreground/80">
              Five lenses on your training: skill balance, monthly volume, Gi vs No-Gi, session
              format, and weekly cadence. Use the rail on the right to switch views. All data
              reflects the selected time window.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Time range */}
      <div className="mb-3">
        <TimeRangeBar
          value={timeWindow}
          onChange={onWindowChange}
          customRange={customRange}
          onCustomRange={onCustomRangeChange}
        />
      </div>

      {/* Subtitle reveal — desktop only */}
      <div className="hidden sm:flex items-start gap-3 mb-3">
        <button
          className="flex-shrink-0 leading-none pt-px transition-all duration-300"
          style={{ color: PALE_YELLOW, opacity: subtitleRevealed ? 1 : 0.4 }}
          aria-label="About this view"
          onMouseEnter={() => setSubtitleRevealed(true)}
        >
          <Triangle
            size={11}
            fill={subtitleRevealed ? CARD_BG : 'currentColor'}
            stroke={subtitleRevealed ? PALE_YELLOW : 'none'}
            strokeWidth={subtitleRevealed ? 1.5 : 0}
          />
        </button>
        <div className="relative flex-1">
          <p className="text-xs leading-relaxed invisible select-none" aria-hidden="true">
            {VIEW_META['prism'].subtitle}
          </p>
          <p
            className="text-xs leading-relaxed absolute inset-0"
            style={{
              color: 'rgba(242,228,168,0.7)',
              opacity: subtitleRevealed ? 1 : 0,
              transition: subtitleRevealed ? 'opacity 700ms ease-in-out' : 'opacity 80ms ease',
            }}
          >
            {VIEW_META[viewMode].subtitle}
          </p>
        </div>
      </div>

      {/* Mobile: full-width segmented control + stacked content (Phase 2 polishes the layout) */}
      <div className="sm:hidden flex flex-col gap-4">
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: SURFACE_2 }}>
          {RAIL_VIEWS.map(({ id, short, Icon }) => {
            const isActive = viewMode === id;
            return (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] touch-manipulation j2-press"
                style={{
                  backgroundColor: isActive ? COPPER : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
                <span className="hidden min-[375px]:inline">{short}</span>
              </button>
            );
          })}
        </div>

        <div className="w-full flex justify-center">
          {viewMode === 'prism' ? (
            <BigPrism normalized={normalized} activeTag={selectedTag} onSelect={onSelectTag} size={Math.min(bigPrismSize, 320)} />
          ) : (
            <div className="w-full max-w-[300px]">{renderChart(viewMode)}</div>
          )}
        </div>

        <div>
          <div
            className="flex justify-end mb-2"
            style={{
              opacity: isVolumeType ? 0 : 1,
              pointerEvents: isVolumeType ? 'none' : 'auto',
              transition: 'opacity 200ms ease',
            }}
          >
            <div className="flex overflow-hidden rounded-lg text-xs" style={{ border: `1px solid ${SURFACE_3_BORDER}` }}>
              <button
                onClick={() => setDisplayMode('hours')}
                className="px-3 py-3 min-h-[40px] touch-manipulation j2-press"
                style={{
                  backgroundColor: displayMode === 'hours' ? COPPER : 'transparent',
                  color: displayMode === 'hours' ? 'white' : 'rgba(255,255,255,0.4)',
                  transition: 'background-color 150ms ease, color 150ms ease',
                }}
              >h</button>
              <button
                onClick={() => setDisplayMode('pct')}
                className="px-3 py-3 min-h-[40px] touch-manipulation j2-press"
                style={{
                  backgroundColor: displayMode === 'pct' ? COPPER : 'transparent',
                  color: displayMode === 'pct' ? 'white' : 'rgba(255,255,255,0.4)',
                  transition: 'background-color 150ms ease, color 150ms ease',
                }}
              >%</button>
            </div>
          </div>
          {renderBreakdownContent(viewMode)}
        </div>
      </div>

      {/* Desktop: chart + breakdown left, rail right */}
      <div className="hidden sm:flex sm:flex-row items-start gap-4">
        <div className="flex-1 flex flex-row items-center gap-6 min-w-0">
          <div className="flex-shrink-0" style={{ maxWidth: viewMode === 'prism' ? bigPrismSize : 320 }}>
            {renderChart(viewMode)}
          </div>
          <div className="flex-1 flex flex-col justify-center gap-3 pl-2">
            {renderBreakdownContent(viewMode)}
          </div>
        </div>

        {/* Rail column: h/% toggle + 5-view icon rail */}
        <div className="hidden sm:flex flex-col items-center gap-3 self-stretch justify-center">
          <div
            style={{
              transformOrigin: 'center center',
              transform: isVolumeType ? 'scaleY(0.04)' : 'scaleY(1)',
              transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div
              className="flex overflow-hidden text-xs"
              style={{
                border: `1px solid ${isVolumeType ? 'transparent' : SURFACE_3_BORDER}`,
                backgroundColor: isVolumeType ? PALE_YELLOW : 'transparent',
                borderRadius: isVolumeType ? '1px' : '6px',
                transition: 'border-color 250ms ease, background-color 250ms ease, border-radius 250ms ease',
              }}
            >
              <button
                onClick={() => setDisplayMode('hours')}
                className="px-3 py-1.5"
                style={{
                  color: isVolumeType ? 'transparent' : displayMode === 'hours' ? 'white' : 'rgba(255,255,255,0.4)',
                  backgroundColor: !isVolumeType && displayMode === 'hours' ? COPPER : 'transparent',
                  transition: 'color 200ms ease, background-color 200ms ease',
                  pointerEvents: isVolumeType ? 'none' : 'auto',
                }}
              >h</button>
              <button
                onClick={() => setDisplayMode('pct')}
                className="px-3 py-1.5"
                style={{
                  color: isVolumeType ? 'transparent' : displayMode === 'pct' ? 'white' : 'rgba(255,255,255,0.4)',
                  backgroundColor: !isVolumeType && displayMode === 'pct' ? COPPER : 'transparent',
                  transition: 'color 200ms ease, background-color 200ms ease',
                  pointerEvents: isVolumeType ? 'none' : 'auto',
                }}
              >%</button>
            </div>
          </div>

          <div className="border-l border-white/10 pl-2 flex flex-col gap-1">
            {RAIL_VIEWS.map(({ id, label, Icon }) => {
              const active = viewMode === id;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode(id)}
                      className="relative w-8 h-8 flex items-center justify-center rounded-md transition-all j2-press"
                      style={{
                        color: active ? PALE_YELLOW : 'rgba(242,228,168,0.2)',
                        backgroundColor: active ? 'rgba(242,228,168,0.06)' : 'transparent',
                      }}
                    >
                      {active && (
                        <div
                          className="absolute top-1.5 bottom-1.5 w-0.5 rounded-full"
                          style={{ left: '-9px', backgroundColor: COPPER }}
                        />
                      )}
                      <Icon
                        size={14}
                        strokeWidth={active ? 2 : 1.5}
                        style={{ filter: active ? `drop-shadow(0 0 4px ${PALE_YELLOW}88)` : 'none' }}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left"><p>{label}</p></TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
