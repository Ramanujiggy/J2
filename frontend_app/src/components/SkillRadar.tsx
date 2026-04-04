import { useState, useEffect, useRef, useMemo } from 'react';
import { Info, Triangle, Target, BarChart2, Layers, BookOpen, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { SKILL_TAGS } from '../lib/constants.ts';
import { CARD_BG, COPPER, COPPER_BORDER, CARD_SHADOW, PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';
import type { SessionSummary } from './TrainingHeatmap.tsx';
import TimeRangeBar from './TimeRangeBar.tsx';

// ─── Pentagon math (Grappling Prism) ─────────────────────────────────────────

const CX = 50;
const CY = 50;
const R  = 38;
const N  = SKILL_TAGS.length; // 5
const LABEL_R = R + 11;

function vertex(i: number, t: number): [number, number] {
  const angle = (2 * Math.PI / N) * i - Math.PI / 2;
  return [CX + R * t * Math.cos(angle), CY + R * t * Math.sin(angle)];
}

function toPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function labelAttrs(i: number): {
  textAnchor: 'start' | 'end' | 'middle';
  dominantBaseline: 'auto' | 'hanging' | 'middle';
} {
  const angle = (2 * Math.PI / N) * i - Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    textAnchor: cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle',
    dominantBaseline: sin < -0.15 ? 'auto' : sin > 0.15 ? 'hanging' : 'middle',
  };
}

function labelLines(label: string): string[] {
  const i = label.indexOf(' ');
  return i !== -1 ? [label.slice(0, i), label.slice(i + 1)] : [label];
}

const SKILL_COLORS: Record<string, { fill: string; stroke: string; dot: string }> = {
  standup:         { fill: 'rgba(255,190,50,0.25)',  stroke: 'rgba(255,190,50,0.75)',  dot: 'rgba(255,190,50,0.9)'  },
  guard_retention: { fill: 'rgba(50,200,200,0.25)',  stroke: 'rgba(50,200,200,0.75)',  dot: 'rgba(50,200,200,0.9)'  },
  submissions:     { fill: 'rgba(220,90,80,0.25)',   stroke: 'rgba(220,90,80,0.75)',   dot: 'rgba(220,90,80,0.9)'   },
  pin_escapes:     { fill: 'rgba(160,100,220,0.25)', stroke: 'rgba(160,100,220,0.75)', dot: 'rgba(160,100,220,0.9)' },
  guard_passing:   { fill: 'rgba(80,140,220,0.25)',  stroke: 'rgba(80,140,220,0.75)',  dot: 'rgba(80,140,220,0.9)'  },
};
const DEFAULT_COLORS = { fill: 'rgba(111,208,140,0.22)', stroke: 'rgba(176,214,100,0.75)', dot: 'rgba(176,214,100,0.9)' };

// ─── Donut chart (Split + Format views) ──────────────────────────────────────

interface DonutSegment { value: number; color: string; }

function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const cx = 70, cy = 70, R = 46, innerR = 28;
  const total = segments.reduce((s, x) => s + x.value, 0);

  if (total === 0) return (
    <svg viewBox="0 0 140 140" width="100%">
      <rect x="0" y="0" width="140" height="140" fill={CARD_BG} rx="12" />
      <circle cx={cx} cy={cy} r={(R + innerR) / 2} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={R - innerR} />
    </svg>
  );

  const GAP = 0.06;
  let angle = -Math.PI / 2;

  const arcs = segments.map((seg, idx) => {
    const frac   = seg.value / total;
    const sweep  = frac * 2 * Math.PI - GAP;
    const start  = angle + GAP / 2;
    angle += frac * 2 * Math.PI;
    if (sweep <= 0) return null;
    const end   = start + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const [c1x, c1y] = [Math.cos(start), Math.sin(start)];
    const [c2x, c2y] = [Math.cos(end),   Math.sin(end)];
    const d = [
      `M ${(cx + R * c1x).toFixed(2)} ${(cy + R * c1y).toFixed(2)}`,
      `A ${R} ${R} 0 ${large} 1 ${(cx + R * c2x).toFixed(2)} ${(cy + R * c2y).toFixed(2)}`,
      `L ${(cx + innerR * c2x).toFixed(2)} ${(cy + innerR * c2y).toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${(cx + innerR * c1x).toFixed(2)} ${(cy + innerR * c1y).toFixed(2)}`,
      'Z',
    ].join(' ');
    return <path key={idx} d={d} fill={seg.color} />;
  });

  return (
    <svg viewBox="0 0 140 140" width="100%">
      <rect x="0" y="0" width="140" height="140" fill={CARD_BG} rx="12" />
      {arcs}
    </svg>
  );
}

// ─── Volume bar chart ─────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function sessionMonth(raw: unknown): number {
  if (raw instanceof Date) return raw.getMonth();
  const str = String(raw);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? parseInt(match[2], 10) - 1 : NaN;
}

function VolumeChart({ sessions }: { sessions: SessionSummary[] }) {
  const monthlyHours = Array(12).fill(0) as number[];
  for (const s of sessions) {
    const m = sessionMonth(s.date);
    if (isNaN(m)) continue;
    monthlyHours[m] += s.duration / 60;
  }
  const maxH = Math.max(...monthlyHours, 0.001);
  const currentMonth = new Date().getMonth();
  const barW = 7;
  const betweenGap = (140 - 8 - 12 * barW) / 11;
  const chartH = 72;
  const baseY  = 84;

  return (
    <svg viewBox="0 0 140 100" width="100%" aria-label="Monthly training volume">
      <rect x="0" y="0" width="140" height="100" fill={CARD_BG} rx="12" />
      {monthlyHours.map((h, m) => {
        const barH = Math.max((h / maxH) * chartH, h > 0 ? 2 : 0);
        const x = 4 + m * (barW + betweenGap);
        const isCurrent = m === currentMonth;
        const fill = isCurrent ? 'rgba(218,116,34,0.75)' : 'rgba(111,208,140,0.55)';
        return (
          <g key={m}>
            {h > 0
              ? <rect x={x} y={baseY - barH} width={barW} height={barH} rx="1.5" fill={fill} />
              : <rect x={x} y={baseY - 1}    width={barW} height={1}    rx="0.5" fill="rgba(255,255,255,0.07)" />
            }
            <text x={x + barW / 2} y={94} textAnchor="middle"
              fill={isCurrent ? PALE_YELLOW : 'rgba(242,228,168,0.25)'}
              fontSize="4.5" fontFamily="sans-serif">
              {MONTH_SHORT[m].slice(0, 1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Segment colors ───────────────────────────────────────────────────────────

const SEG_GI    = 'rgba(111,208,140,0.80)';
const SEG_NOGI  = 'rgba(218,116,34,0.80)';
const SEG_CLASS = 'rgba(111,208,140,0.80)';
const SEG_DRILL = 'rgba(242,228,168,0.65)';
const SEG_COMP  = 'rgba(220,90,80,0.80)';

// ─── Rail config ──────────────────────────────────────────────────────────────

type ViewMode = 'prism' | 'volume' | 'split' | 'format';
export type TimeWindow = '7d' | '14d' | '30d' | '90d' | '180d' | '1y' | 'custom';

const RAIL_VIEWS: { id: ViewMode; label: string; short: string; Icon: LucideIcon }[] = [
  { id: 'prism',  label: 'Grappling Prism',  short: 'Prism',  Icon: Target    },
  { id: 'volume', label: 'Volume by Month',   short: 'Volume', Icon: BarChart2 },
  { id: 'split',  label: 'The Two Worlds',    short: 'Split',  Icon: Layers    },
  { id: 'format', label: 'Session Format',    short: 'Format', Icon: BookOpen  },
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
};

// ─── Component ────────────────────────────────────────────────────────────────

interface SkillRadarProps {
  sessions: SessionSummary[];
  timeWindow: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
  customRange: { start: string; end: string } | null;
  onCustomRangeChange: (r: { start: string; end: string } | null) => void;
}

export default function SkillRadar({ sessions, timeWindow, onWindowChange, customRange, onCustomRangeChange }: SkillRadarProps) {
  const [subtitleRevealed, setSubtitleRevealed] = useState(false);
  const [displayMode, setDisplayMode] = useState<'hours' | 'pct'>('hours');
  const [viewMode, setViewMode] = useState<ViewMode>('prism');
  const [prevViewMode, setPrevViewMode] = useState<ViewMode | null>(null);
  const [slideDir, setSlideDir] = useState<'up' | 'down'>('up');
  const animLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety-net: clear the animation lock after 750ms even if onAnimationEnd doesn't fire (iOS Safari)
  useEffect(() => {
    if (prevViewMode === null) return;
    animLockTimer.current = setTimeout(() => setPrevViewMode(null), 750);
    return () => {
      if (animLockTimer.current !== null) clearTimeout(animLockTimer.current);
    };
  }, [prevViewMode]);

  // Mobile Easter egg: auto-reveal the Triangle subtitle after each view switch.
  // Touch devices have no hover, so the subtitle would never appear otherwise.
  useEffect(() => {
    const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouchOnly) {
      setSubtitleRevealed(false); // desktop: reset on view change, user hovers to reveal
      return;
    }
    setSubtitleRevealed(false);
    const t = setTimeout(() => setSubtitleRevealed(true), 1200);
    return () => clearTimeout(t);
  }, [viewMode]);
  // (subtitle reset on view-change is handled above — no separate effect needed)

  function handleViewChange(id: ViewMode) {
    if (id === viewMode || prevViewMode !== null) return;
    const currentIdx = RAIL_VIEWS.findIndex(v => v.id === viewMode);
    const nextIdx    = RAIL_VIEWS.findIndex(v => v.id === id);
    setSlideDir(nextIdx > currentIdx ? 'up' : 'down');
    setPrevViewMode(viewMode);
    setViewMode(id);
  }

  // ── Filtered sessions ──
  const WINDOW_DAYS: Partial<Record<TimeWindow, number>> = {
    '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180, '1y': 365,
  };
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

  // ── Prism data ──
  const hoursMap: Record<string, number> = Object.fromEntries(SKILL_TAGS.map(({ value }) => [value, 0]));
  for (const s of filtered) {
    for (const tag of s.tags ?? []) {
      if (tag in hoursMap) hoursMap[tag] += s.duration / 60;
    }
  }
  const hours            = SKILL_TAGS.map(({ value }) => hoursMap[value]);
  const maxHours         = Math.max(...hours, 0.001);
  const normalized       = hours.map(h => h / maxHours);
  const totalTaggedHours = hours.reduce((a, b) => a + b, 0);
  const hasData          = hours.some(h => h > 0);
  const dominantIndex    = hours.indexOf(Math.max(...hours));
  const dominantSkill    = hasData ? SKILL_TAGS[dominantIndex].value : null;
  const polygonColors    = dominantSkill ? (SKILL_COLORS[dominantSkill] ?? DEFAULT_COLORS) : DEFAULT_COLORS;
  const gridRings        = [0.25, 0.5, 0.75, 1].map(t => SKILL_TAGS.map((_, i) => vertex(i, t)) as [number, number][]);
  const dataPolygon      = SKILL_TAGS.map((_, i) => vertex(i, Math.max(normalized[i], 0.02))) as [number, number][];

  // ── Split data ──
  const giHours    = filtered.filter(s => s.gi_nogi === 'gi').reduce((sum, s) => sum + s.duration / 60, 0);
  const nogiHours  = filtered.filter(s => s.gi_nogi === 'no_gi').reduce((sum, s) => sum + s.duration / 60, 0);
  const splitTotal = giHours + nogiHours;

  // ── Format data ──
  const classHours  = filtered.filter(s => s.session_type === 'class').reduce((sum, s) => sum + s.duration / 60, 0);
  const drillHours  = filtered.filter(s => s.session_type === 'drilling').reduce((sum, s) => sum + s.duration / 60, 0);
  const compHours   = filtered.filter(s => s.session_type === 'competition_training').reduce((sum, s) => sum + s.duration / 60, 0);
  const formatTotal = classHours + drillHours + compHours;

  // ── Volume stats ──
  const monthlyHoursArr = Array(12).fill(0) as number[];
  for (const s of filtered) {
    const m = sessionMonth(s.date);
    if (!isNaN(m)) monthlyHoursArr[m] += s.duration / 60;
  }
  const totalVolHours = monthlyHoursArr.reduce((a, b) => a + b, 0);
  const peakMonthIdx  = monthlyHoursArr.indexOf(Math.max(...monthlyHoursArr));
  const trainedMonths = monthlyHoursArr.filter(h => h > 0).length;
  const avgPerMonth   = trainedMonths > 0 ? totalVolHours / trainedMonths : 0;

  // ── Pre-computed row arrays ──
  const prismRows  = SKILL_TAGS.map(({ value, label }, i) => ({ label, h: hours[i], total: totalTaggedHours, color: undefined as string | undefined }));
  const splitRows  = [{ label: 'Gi', h: giHours, total: splitTotal, color: SEG_GI }, { label: 'No-Gi', h: nogiHours, total: splitTotal, color: SEG_NOGI }];
  const formatRows = [
    { label: 'Class',       h: classHours, total: formatTotal, color: SEG_CLASS },
    { label: 'Drilling',    h: drillHours, total: formatTotal, color: SEG_DRILL },
    { label: 'Competition', h: compHours,  total: formatTotal, color: SEG_COMP  },
  ];

  // ── Helpers ──
  function fmtVal(h: number, total: number): string {
    if (h <= 0) return '—';
    return displayMode === 'hours'
      ? `${h.toFixed(1)}h`
      : `${total > 0 ? ((h / total) * 100).toFixed(0) : 0}%`;
  }

  const BAR_MAX_PX = 80;

  // ── Chart renderer — shared by mobile and desktop ──
  function renderChart(mode: ViewMode) {
    if (mode === 'volume') return <VolumeChart sessions={filtered} />;
    if (mode === 'split') return (
      <DonutChart segments={[
        { value: giHours,   color: SEG_GI   },
        { value: nogiHours, color: SEG_NOGI  },
      ]} />
    );
    if (mode === 'format') return (
      <DonutChart segments={[
        { value: classHours, color: SEG_CLASS },
        { value: drillHours, color: SEG_DRILL },
        { value: compHours,  color: SEG_COMP  },
      ]} />
    );
    // prism
    return (
      <svg viewBox="-20 -20 140 140" width="100%" aria-label="Skill radar chart">
        <rect x="-20" y="-20" width="140" height="140" fill={CARD_BG} rx="12" />
        {gridRings.map((pts, ri) => (
          <polygon key={ri} points={toPoints(pts)} fill="none"
            stroke={PALE_YELLOW} strokeOpacity={ri === 3 ? 0.25 : 0.12} strokeWidth="0.5" />
        ))}
        {SKILL_TAGS.map((_, i) => {
          const [x, y] = vertex(i, 1);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y}
            stroke={PALE_YELLOW} strokeOpacity="0.18" strokeWidth="0.5" />;
        })}
        <polygon points={toPoints(dataPolygon)} fill={polygonColors.fill}
          stroke={polygonColors.stroke} strokeWidth="1" strokeLinejoin="round" />
        {dataPolygon.map(([x, y], i) => normalized[i] > 0.02 && (
          <circle key={i} cx={x} cy={y} r="1.5" fill={polygonColors.dot} />
        ))}
        {SKILL_TAGS.map(({ label }, i) => {
          const angle = (2 * Math.PI / N) * i - Math.PI / 2;
          const lx = CX + LABEL_R * Math.cos(angle);
          const ly = CY + LABEL_R * Math.sin(angle);
          const { textAnchor, dominantBaseline } = labelAttrs(i);
          const lines = labelLines(label);
          const yOffset = lines.length > 1 ? -3 : 0;
          return (
            <text key={i} x={lx.toFixed(2)} y={(ly + yOffset).toFixed(2)}
              textAnchor={textAnchor} dominantBaseline={dominantBaseline}
              fill={PALE_YELLOW} fontSize="5" fontWeight="700" fontFamily="sans-serif">
              {lines.map((line, li) => (
                <tspan key={li} x={lx.toFixed(2)} dy={li === 0 ? '0' : '6'}>{line}</tspan>
              ))}
            </text>
          );
        })}
      </svg>
    );
  }

  // ── Breakdown / stats renderer — shared by mobile and desktop ──
  function renderBreakdownContent(mode: ViewMode) {
    if (mode === 'volume') {
      return (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Total',    value: totalVolHours > 0 ? `${totalVolHours.toFixed(1)}h` : '—', active: totalVolHours > 0 },
            { label: 'Peak',     value: totalVolHours > 0 ? MONTH_SHORT[peakMonthIdx]        : '—', active: totalVolHours > 0 },
            { label: 'Avg / mo', value: avgPerMonth   > 0 ? `${avgPerMonth.toFixed(1)}h`     : '—', active: avgPerMonth   > 0 },
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
    const rows = mode === 'prism' ? prismRows : mode === 'split' ? splitRows : formatRows;
    const maxRowH = Math.max(...rows.map(r => r.h), 0.001);
    return (
      <div className="space-y-3">
        {rows.map(({ label, h, total, color }) => {
          const barW = displayMode === 'hours'
            ? (h > 0 ? Math.max((h / maxRowH) * BAR_MAX_PX, 6) : 2)
            : 1.5;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {color && (
                  <div className="flex-shrink-0" style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                )}
                <span className="text-xs font-bold" style={{ color: PALE_YELLOW }}>{label}</span>
              </div>
              <div
                className="flex-shrink-0"
                style={{
                  width:  `${barW}px`,
                  height: displayMode === 'hours' ? '5px' : '13px',
                  backgroundColor: h > 0
                    ? (displayMode === 'hours' ? 'rgba(242,228,168,0.45)' : 'rgba(242,228,168,0.25)')
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
      </div>
    );
  }

  // ── Desktop drum renderer (absolute inset-0 for slide animations) ──
  function renderContent(mode: ViewMode, animClass = '', onAnimEnd?: () => void) {
    return (
      <div className={`absolute inset-0 flex flex-col gap-2 ${animClass}`} onAnimationEnd={onAnimEnd}>
        <div className="flex-1 flex flex-row items-center gap-4 min-h-0">
          <div className="flex-shrink-0" style={{ maxWidth: mode === 'volume' ? '42%' : 280 }}>
            {renderChart(mode)}
          </div>
          <div className="flex-1 flex flex-col justify-center gap-3 pl-6">
            {renderBreakdownContent(mode)}
          </div>
        </div>
      </div>
    );
  }

  const isVolume = viewMode === 'volume';

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}>

      {/* ── Header: title row ── */}
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
                This instrument maps your training across four lenses: skill balance, monthly
                volume, Gi vs No-Gi split, and session format. Use the rail on the right to
                switch views. All data reflects the selected time window.
              </p>
            </TooltipContent>
          </Tooltip>
      </div>

      {/* ── Time range bar — always full-width row ── */}
      <div className="mb-3">
        <TimeRangeBar
          value={timeWindow}
          onChange={onWindowChange}
          customRange={customRange}
          onCustomRange={onCustomRangeChange}
        />
      </div>

      {/* ── Subtitle reveal — outside drum, never clipped — desktop only ── */}
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
          {/* Invisible spacer locked to the longest subtitle — keeps height constant across all views */}
          <p className="text-xs leading-relaxed invisible select-none" aria-hidden="true">
            {VIEW_META['prism'].subtitle}
          </p>
          {/* Actual subtitle overlaid on top */}
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

      {/* ── Mobile: full redesign ── */}
      <div className="sm:hidden flex flex-col gap-4">

        {/* View tabs — full-width segmented control */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {RAIL_VIEWS.map(({ id, short, Icon }) => {
            const isActive = viewMode === id;
            return (
              <button
                key={id}
                onClick={() => handleViewChange(id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors min-h-[44px]"
                style={{
                  backgroundColor: isActive ? COPPER : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              >
                <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
                <span>{short}</span>
              </button>
            );
          })}
        </div>

        {/* Chart — responsive, scales with card width */}
        <div className="w-full max-w-[280px] mx-auto">
          {renderChart(viewMode)}
        </div>

        {/* h/% toggle + breakdown */}
        <div>
          {/* Toggle row — fades out on volume view */}
          <div
            className="flex justify-end mb-2"
            style={{
              opacity: isVolume ? 0 : 1,
              pointerEvents: isVolume ? 'none' : 'auto',
              transition: 'opacity 200ms ease',
            }}
          >
            <div className="flex overflow-hidden rounded-lg text-xs" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <button
                onClick={() => setDisplayMode('hours')}
                className="px-3 py-2"
                style={{
                  backgroundColor: displayMode === 'hours' ? 'rgba(218,116,34,0.8)' : 'transparent',
                  color: displayMode === 'hours' ? 'white' : 'rgba(255,255,255,0.4)',
                  transition: 'background-color 150ms ease, color 150ms ease',
                }}
              >h</button>
              <button
                onClick={() => setDisplayMode('pct')}
                className="px-3 py-2"
                style={{
                  backgroundColor: displayMode === 'pct' ? 'rgba(218,116,34,0.8)' : 'transparent',
                  color: displayMode === 'pct' ? 'white' : 'rgba(255,255,255,0.4)',
                  transition: 'background-color 150ms ease, color 150ms ease',
                }}
              >%</button>
            </div>
          </div>

          {renderBreakdownContent(viewMode)}
        </div>

      </div>

      {/* ── Desktop: drum | rail column ── */}
      <div className="hidden sm:flex sm:flex-row items-start gap-4">

        {/* Drum — panels contain chart + breakdown with slide animation */}
        <div className="flex-1 relative overflow-hidden h-[320px] min-w-0">

          {/* Exiting panel */}
          {prevViewMode !== null &&
            renderContent(prevViewMode, slideDir === 'up' ? 'animate-view-exit-up' : 'animate-view-exit-down')
          }

          {/* Entering / active panel */}
          {renderContent(
            viewMode,
            prevViewMode !== null ? (slideDir === 'up' ? 'animate-view-enter-up' : 'animate-view-enter-down') : '',
            prevViewMode !== null ? () => setPrevViewMode(null) : undefined,
          )}

        </div>

        {/* ── Rail column: toggle above icons, vertically centered — desktop only ── */}
        <div className="hidden sm:flex flex-col items-center gap-3 self-stretch justify-center">

          {/* h/% toggle — collapses to pale yellow line on volume view */}
          <div
            style={{
              transformOrigin: 'center center',
              transform: isVolume ? 'scaleY(0.04)' : 'scaleY(1)',
              transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <div
              className="flex overflow-hidden text-xs"
              style={{
                border: `1px solid ${isVolume ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: isVolume ? PALE_YELLOW : 'transparent',
                borderRadius: isVolume ? '1px' : '6px',
                transition: 'border-color 250ms ease, background-color 250ms ease, border-radius 250ms ease',
              }}
            >
              <button
                onClick={() => setDisplayMode('hours')}
                className="px-3 py-1.5"
                style={{
                  color: isVolume ? 'transparent' : displayMode === 'hours' ? 'white' : 'rgba(255,255,255,0.4)',
                  backgroundColor: !isVolume && displayMode === 'hours' ? 'rgba(218,116,34,0.8)' : 'transparent',
                  transition: 'color 200ms ease, background-color 200ms ease',
                  pointerEvents: isVolume ? 'none' : 'auto',
                }}
              >h</button>
              <button
                onClick={() => setDisplayMode('pct')}
                className="px-3 py-1.5"
                style={{
                  color: isVolume ? 'transparent' : displayMode === 'pct' ? 'white' : 'rgba(255,255,255,0.4)',
                  backgroundColor: !isVolume && displayMode === 'pct' ? 'rgba(218,116,34,0.8)' : 'transparent',
                  transition: 'color 200ms ease, background-color 200ms ease',
                  pointerEvents: isVolume ? 'none' : 'auto',
                }}
              >%</button>
            </div>
          </div>

          {/* View icon rail with left border */}
          <div className="border-l border-white/10 pl-2 flex flex-col gap-1">
            {RAIL_VIEWS.map(({ id, label, Icon }) => {
              const active = viewMode === id;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleViewChange(id)}
                      className="relative w-8 h-8 flex items-center justify-center rounded-md transition-all"
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
