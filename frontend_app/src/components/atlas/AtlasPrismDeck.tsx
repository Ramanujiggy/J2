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
import { SKILL_TAGS, MONTH_NAMES } from '../../lib/constants.ts';
import { COPPER, PALE_YELLOW, GLOW_SOFT, SURFACE_3_BORDER, PAGE_BG } from '../../lib/theme.ts';
import { WINDOW_DAYS, type TimeWindow, sessionPillarHours, tagHoursInRange } from '../../lib/analyticsUtils.ts';
import { giShare, nogiShare } from '../../lib/sessionUtils.ts';
import type { SessionSummary } from '../TrainingHeatmap.tsx';
import type { Intention } from '../../types/api.ts';
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

// Sub-view rail — desktop renders as a horizontal text-link row beneath the
// chart; mobile collapses to a segmented control. Both surfaces use the same
// short label. The `prism` entry's short reads as "Shape" — the page already
// frames it as "your grappling shape" in the reading sentence above, so the
// rail label only needs to be a tag, not a title.
const RAIL_VIEWS: { id: ViewMode; short: string }[] = [
  { id: 'prism',  short: 'Shape'   },
  { id: 'volume', short: 'Volume'  },
  { id: 'split',  short: 'Split'   },
  { id: 'format', short: 'Format'  },
  { id: 'weekly', short: 'Weekly'  },
];

interface Props {
  sessions: SessionSummary[];
  /** Used for the alignment overlay — per-pillar alignment % comes from
   *  intentions whose heading matches a pillar, hours-weighted. */
  intentions: Intention[];
  timeWindow: TimeWindow;
  customRange: { start: string; end: string } | null;
  /** Lifted up so the parent can render a vertex-specific stats row beneath the deck. */
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  /** Lifted up so the parent can hide the vertex zoom on non-Shape sub-views
   *  and adapt the reading sentence per sub-view. */
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  /** Desktop renders a larger BigPrism; mobile (Phase 2) renders compact. */
  bigPrismSize?: number;
}

export default function AtlasPrismDeck({
  sessions, intentions, timeWindow, customRange,
  selectedTag, onSelectTag,
  viewMode, onViewModeChange,
  bigPrismSize = 480,
}: Props) {
  const [displayMode, setDisplayMode] = useState<'hours' | 'pct'>('hours');
  const setViewMode = onViewModeChange;
  const weeklyScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll weekly chart to current week
  useEffect(() => {
    if (viewMode !== 'weekly') return;
    const el = weeklyScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' });
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

  // ── Alignment overlay (per-pillar) ──
  // For each pillar, compute hours-weighted alignment across intentions that
  // targeted that pillar AND started within the current time window.
  // matchHours = time spent on the pillar during the intention's date range
  // totalHours = total training time during that date range
  // Pillar alignment = Σ matchHours / Σ totalHours across matching intentions.
  // If no intentions targeted a pillar in window, alignment = 0 (no overlay vertex).
  const alignmentNormalized = useMemo(() => {
    // Determine window cutoffs (mirrors `filtered` logic but for intentions).
    let windowStart: Date | null = null;
    let windowEnd: Date | null = null;
    if (timeWindow === 'custom' && customRange) {
      windowStart = new Date(customRange.start + 'T00:00:00');
      windowEnd   = new Date(customRange.end   + 'T23:59:59');
    } else {
      const days = WINDOW_DAYS[timeWindow];
      if (days != null) windowStart = new Date(Date.now() - days * 86_400_000);
    }

    return SKILL_TAGS.map(({ value }) => {
      let matchSum = 0;
      let totalSum = 0;
      for (const i of intentions) {
        if (i.heading !== value) continue;
        const ws = new Date(i.week_start + 'T00:00:00');
        if (windowStart && ws < windowStart) continue;
        if (windowEnd && ws > windowEnd) continue;
        const tagHours = tagHoursInRange(sessions, i.week_start, i.duration_days);
        const t = Object.values(tagHours).reduce((a, b) => a + b, 0);
        if (t <= 0) continue;
        const m = tagHours[value] ?? 0;
        matchSum += m;
        totalSum += t;
      }
      return totalSum > 0 ? matchSum / totalSum : 0;
    });
  }, [sessions, intentions, timeWindow, customRange]);

  // ── Prism data ──
  // Memoized so the `normalized` array reference passed to BigPrism is stable
  // across renders that don't change `filtered`. Without this, BigPrism's
  // React.memo bails on every parent re-render. (Tier 3 perf audit.)
  const { hoursMap, hours, normalized, totalTaggedHours, hasData, dominantIndex } = useMemo(() => {
    const hoursMap: Record<string, number> = Object.fromEntries(SKILL_TAGS.map(({ value }) => [value, 0]));
    for (const s of filtered) {
      const ph = sessionPillarHours(s);
      for (const [k, v] of Object.entries(ph)) {
        if (k in hoursMap) hoursMap[k] += v;
      }
    }
    const hours         = SKILL_TAGS.map(({ value }) => hoursMap[value]);
    const maxHours      = Math.max(...hours, 0.001);
    const normalized    = hours.map(h => h / maxHours);
    return {
      hoursMap,
      hours,
      normalized,
      totalTaggedHours: hours.reduce((a, b) => a + b, 0),
      hasData: hours.some(h => h > 0),
      dominantIndex: hours.indexOf(Math.max(...hours)),
    };
  }, [filtered]);

  // ── Split / Format / Volume / Weekly stats ──
  // 'both' (mig 025) counts 0.5 toward each side via giShare/nogiShare.
  const giHours    = filtered.reduce((sum, s) => sum + s.duration / 60 * giShare(s.gi_nogi), 0);
  const nogiHours  = filtered.reduce((sum, s) => sum + s.duration / 60 * nogiShare(s.gi_nogi), 0);
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
    ? priorFiltered.reduce((sum, s) => sum + s.duration / 60 * (giShare(s.gi_nogi) + nogiShare(s.gi_nogi)), 0)
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

  const BAR_MAX_PX = 96;

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
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6" style={{ background: `linear-gradient(to right, ${PAGE_BG}, transparent)` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6" style={{ background: `linear-gradient(to left, ${PAGE_BG}, transparent)` }} />
      </div>
    );
    if (mode === 'split') return (
      <div className="flex justify-center">
        <div style={{ width: '100%', maxWidth: 560, aspectRatio: '1' }}>
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
        <div style={{ width: '100%', maxWidth: 560, aspectRatio: '1' }}>
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
        alignmentNormalized={alignmentNormalized}
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
              <span className="font-bold" style={{ fontSize: 14, color: PALE_YELLOW }}>{label}</span>
              <span style={{ fontSize: 14, color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="font-bold" style={{ fontSize: 29,
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.15)',
                textShadow: active ? GLOW_SOFT : 'none',
              }}>{value}</span>
              {d && <span style={{ fontSize: 13, fontWeight: 600, alignSelf: 'center', color: d.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)' }}>{d}</span>}
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
              <span className="font-bold" style={{ fontSize: 14, color: PALE_YELLOW }}>{label}</span>
              <span style={{ fontSize: 14, color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="font-bold" style={{ fontSize: 29,
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
            { label: 'Total',  color: null,     value: splitTotal > 0 ? `${splitTotal.toFixed(1)}h` : '—', active: splitTotal > 0, d: delta(splitTotal,  priorSplitTotal) },
            { label: 'Gi',     color: SEG_GI,   value: giHours   > 0 ? fmtVal(giHours,   splitTotal) : '—', active: giHours   > 0 },
            { label: 'No-Gi',  color: SEG_NOGI, value: nogiHours > 0 ? fmtVal(nogiHours, splitTotal) : '—', active: nogiHours > 0 },
          ].map(({ label, color, value, active, d }) => (
            <div key={label} className="flex items-baseline gap-2 flex-wrap">
              {color && (
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, alignSelf: 'center', flexShrink: 0 }} />
              )}
              <span className="font-bold" style={{ fontSize: 14, color: PALE_YELLOW }}>{label}</span>
              <span style={{ fontSize: 14, color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="font-bold" style={{ fontSize: 29,
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.15)',
                textShadow: active ? GLOW_SOFT : 'none',
              }}>{value}</span>
              {d && <span style={{ fontSize: 13, fontWeight: 600, alignSelf: 'center', color: d.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)' }}>{d}</span>}
            </div>
          ))}
        </div>
      );
    }
    if (mode === 'format') {
      return (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Total',  color: null,      value: formatTotal > 0 ? `${formatTotal.toFixed(1)}h` : '—', active: formatTotal > 0, d: delta(formatTotal, priorFormatTotal) },
            { label: 'Class',  color: SEG_CLASS, value: classHours > 0 ? fmtVal(classHours, formatTotal) : '—', active: classHours > 0 },
            { label: 'Drill',  color: SEG_DRILL, value: drillHours > 0 ? fmtVal(drillHours, formatTotal) : '—', active: drillHours > 0 },
            { label: 'Comp',   color: SEG_COMP,  value: compHours  > 0 ? fmtVal(compHours,  formatTotal) : '—', active: compHours  > 0 },
          ].map(({ label, color, value, active, d }) => (
            <div key={label} className="flex items-baseline gap-2 flex-wrap">
              {color && (
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, alignSelf: 'center', flexShrink: 0 }} />
              )}
              <span className="font-bold" style={{ fontSize: 14, color: PALE_YELLOW }}>{label}</span>
              <span style={{ fontSize: 14, color: 'rgba(242,228,168,0.25)' }}>|</span>
              <span className="font-bold" style={{ fontSize: 29,
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.15)',
                textShadow: active ? GLOW_SOFT : 'none',
              }}>{value}</span>
              {d && <span style={{ fontSize: 13, fontWeight: 600, alignSelf: 'center', color: d.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)' }}>{d}</span>}
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
                  className="font-bold"
                  style={{ fontSize: 14, color: isDominant ? color : PALE_YELLOW }}
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
              <span className="font-bold" style={{
                fontSize: 17,
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
              <span className="font-bold" style={{ fontSize: 17, color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                {entropy.score.toFixed(2)}
              </span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.30)' }}>
                {entropy.label}
              </span>
            </div>
          );
        })()}
      </div>
    );
  }

  const isVolumeType = viewMode === 'volume' || viewMode === 'weekly';

  // ── Editorial workspace ──────────────────────────────────────────────
  // No outer card chrome — sits directly on PAGE_BG. Mobile keeps a vertical
  // stack; desktop is a 2-column workspace (Prism left, annotations + sub-view
  // rail right) so the page reads horizontally rather than as a centered slide.
  return (
    <div style={{ backgroundColor: 'transparent' }}>

      {/* Mobile layout — vertical stack.
          Sub-view title is intentionally omitted: the page-level reading
          sentence (sub-view-aware in v4) tells the reader what view they're
          on, and the sub-view rail at the bottom of the deck confirms it. */}
      <div className="sm:hidden flex flex-col gap-5">
        <div className="w-full flex justify-center">
          {viewMode === 'prism' ? (
            <BigPrism normalized={normalized} alignmentNormalized={alignmentNormalized} activeTag={selectedTag} onSelect={onSelectTag} size={Math.min(bigPrismSize, 320)} />
          ) : (
            <div className="w-full max-w-[300px]">{renderChart(viewMode)}</div>
          )}
        </div>

        <div>
          <div
            className="flex items-center justify-between mb-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}
          >
            <span
              className="j2-label-micro"
              style={{ fontSize: 12, color: 'rgba(242,228,168,0.55)' }}
            >
              {viewMode === 'prism' ? 'Hours per pillar' : 'Breakdown'}
            </span>
            <div
              style={{
                opacity: isVolumeType ? 0 : 1,
                pointerEvents: isVolumeType ? 'none' : 'auto',
                transition: 'opacity 200ms ease',
              }}
            >
              <div className="flex overflow-hidden rounded-md text-xs" style={{ border: `1px solid ${SURFACE_3_BORDER}` }}>
                <button
                  onClick={() => setDisplayMode('hours')}
                  className="px-3 py-2 min-h-[36px] touch-manipulation j2-press"
                  style={{
                    backgroundColor: displayMode === 'hours' ? COPPER : 'transparent',
                    color: displayMode === 'hours' ? 'white' : 'rgba(255,255,255,0.4)',
                    transition: 'background-color 150ms ease, color 150ms ease',
                  }}
                >h</button>
                <button
                  onClick={() => setDisplayMode('pct')}
                  className="px-3 py-2 min-h-[36px] touch-manipulation j2-press"
                  style={{
                    backgroundColor: displayMode === 'pct' ? COPPER : 'transparent',
                    color: displayMode === 'pct' ? 'white' : 'rgba(255,255,255,0.4)',
                    transition: 'background-color 150ms ease, color 150ms ease',
                  }}
                >%</button>
              </div>
            </div>
          </div>
          {renderBreakdownContent(viewMode)}
        </div>

        {/* Sub-view text rail (mobile) — single line, wraps if needed */}
        <SubViewRail value={viewMode} onChange={setViewMode} />
      </div>

      {/* Desktop layout — 2-column workspace.
          LEFT (auto-flex): the visualization, vertically centered in its column.
          RIGHT (380px):    annotations + sub-view rail, stacked.

          The eye scans Prism → legend → sub-view rail in one rightward sweep.
          Replaces the centered single-column stack that read as a slide. */}
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: '1fr 460px',
          gap: 76,
          alignItems: 'start',
        }}
      >
        {/* LEFT — visualization. Each sub-view picks its own footprint:
            • Shape  : square BigPrism, capped at 520 (centered)
            • Split  : large donut, capped at 480 (centered)
            • Format : large donut, capped at 480 (centered)
            • Volume : horizontal time-series — fills the column
            • Weekly : 52-week scrollable strip — fills the column         */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: bigPrismSize,
            paddingTop: viewMode === 'prism' ? 0 : 16,
          }}
        >
          <div
            style={{
              maxWidth:
                viewMode === 'prism'                    ? bigPrismSize
              : viewMode === 'split' || viewMode === 'format' ? 600
                                                              : '100%',
              width: '100%',
            }}
          >
            {renderChart(viewMode)}
          </div>
        </div>

        {/* RIGHT — annotations stack. No sub-view title block — the
            page-level reading sentence and the sub-view rail already convey
            what view is active, so a heading here would be redundant. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>

          {/* Section: Hours per pillar (prism) / Breakdown (others) + h/% toggle */}
          <div>
            <div
              className="flex items-center justify-between"
              style={{
                borderTop: '1px solid rgba(196,145,95,0.18)',
                paddingTop: 14,
                marginBottom: 16,
              }}
            >
              <span
                className="j2-label-micro"
                style={{ fontSize: 12, color: 'rgba(242,228,168,0.55)', letterSpacing: '0.16em' }}
              >
                {viewMode === 'prism' ? 'Hours per pillar' : 'Breakdown'}
              </span>
              <div
                style={{
                  opacity: isVolumeType ? 0 : 1,
                  pointerEvents: isVolumeType ? 'none' : 'auto',
                  transition: 'opacity 200ms ease',
                }}
              >
                <div
                  className="flex overflow-hidden text-xs"
                  style={{ border: `1px solid ${SURFACE_3_BORDER}`, borderRadius: 6 }}
                >
                  <button
                    onClick={() => setDisplayMode('hours')}
                    className="px-3 py-1.5"
                    style={{
                      color: displayMode === 'hours' ? 'white' : 'rgba(255,255,255,0.4)',
                      backgroundColor: displayMode === 'hours' ? COPPER : 'transparent',
                      transition: 'color 200ms ease, background-color 200ms ease',
                    }}
                  >h</button>
                  <button
                    onClick={() => setDisplayMode('pct')}
                    className="px-3 py-1.5"
                    style={{
                      color: displayMode === 'pct' ? 'white' : 'rgba(255,255,255,0.4)',
                      backgroundColor: displayMode === 'pct' ? COPPER : 'transparent',
                      transition: 'color 200ms ease, background-color 200ms ease',
                    }}
                  >%</button>
                </div>
              </div>
            </div>
            {renderBreakdownContent(viewMode)}
          </div>

          {/* Section: Other views — vertical rail with copper left-marker on active */}
          <div style={{ borderTop: '1px solid rgba(196,145,95,0.18)', paddingTop: 16 }}>
            <span
              className="j2-label-micro"
              style={{
                display: 'block',
                marginBottom: 14,
                fontSize: 12,
                color: 'rgba(242,228,168,0.55)',
                letterSpacing: '0.16em',
              }}
            >
              Other views
            </span>
            <SubViewRail value={viewMode} onChange={setViewMode} orientation="vertical" />
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Sub-view text rail ───────────────────────────────────────────────────
// Replaces the icon rail on the side. Quiet text links — selected is
// PALE_YELLOW, unselected is white-at-50% with copper-at-50% on hover.
//
// Two orientations:
//   • 'horizontal' — used by mobile and (legacy) horizontal placements.
//     Items inline with `·` separators, wraps if needed.
//   • 'vertical'   — used in the desktop right-column workspace. Items stack
//     with a copper left-rail marker on the active item, like a sidebar nav.
function SubViewRail({
  value, onChange, orientation = 'horizontal',
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
  orientation?: 'horizontal' | 'vertical';
}) {
  if (orientation === 'vertical') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {RAIL_VIEWS.map(({ id, short }) => {
          const active = id === value;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              style={{
                position: 'relative',
                fontSize: 17,
                fontWeight: active ? 600 : 500,
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.50)',
                background: 'transparent',
                border: 'none',
                padding: '2px 0 2px 14px',
                cursor: 'pointer',
                letterSpacing: '0.02em',
                textShadow: active ? GLOW_SOFT : 'none',
                textAlign: 'left',
                transition: 'color 160ms ease',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = COPPER; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.50)'; }}
            >
              {/* Copper left-rail marker on active — the only chrome */}
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0, top: 4, bottom: 4,
                    width: 2,
                    backgroundColor: COPPER,
                    borderRadius: 1,
                  }}
                />
              )}
              {short}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      {RAIL_VIEWS.map(({ id, short }, i) => {
        const active = id === value;
        return (
          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
            <button
              onClick={() => onChange(id)}
              style={{
                fontSize: 16,
                fontWeight: active ? 600 : 500,
                color: active ? PALE_YELLOW : 'rgba(255,255,255,0.50)',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                textShadow: active ? GLOW_SOFT : 'none',
                transition: 'color 160ms ease',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = COPPER; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.50)'; }}
            >
              {short}
            </button>
            {i < RAIL_VIEWS.length - 1 && (
              <span aria-hidden style={{ color: 'rgba(255,255,255,0.18)', fontSize: 14 }}>·</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
