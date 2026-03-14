import { useState } from 'react';
import { Info, Triangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { SKILL_TAGS } from '../lib/constants.ts';
import type { SessionSummary } from './TrainingHeatmap.tsx';

// SVG coordinate space
const CX = 50;
const CY = 50;
const R  = 38; // outer radius — leaves room for labels in 100×100 space

const N = SKILL_TAGS.length; // 5

// Pentagon vertex at axis i, scaled by fraction t (0–1)
function vertex(i: number, t: number): [number, number] {
  const angle = (2 * Math.PI / N) * i - Math.PI / 2;
  return [CX + R * t * Math.cos(angle), CY + R * t * Math.sin(angle)];
}

// Convert array of [x,y] pairs to SVG points string
function toPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

// Label anchor attributes based on angle position
function labelAttrs(i: number): {
  textAnchor: 'start' | 'end' | 'middle';
  dominantBaseline: 'auto' | 'hanging' | 'middle';
} {
  const angle = (2 * Math.PI / N) * i - Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const textAnchor: 'start' | 'end' | 'middle' =
    cos > 0.15  ? 'start' :
    cos < -0.15 ? 'end'   : 'middle';
  const dominantBaseline: 'auto' | 'hanging' | 'middle' =
    sin < -0.15 ? 'auto'    :
    sin > 0.15  ? 'hanging' : 'middle';
  return { textAnchor, dominantBaseline };
}

// Split multi-word labels onto two lines for the SVG chart
function labelLines(label: string): string[] {
  const spaceIdx = label.indexOf(' ');
  return spaceIdx !== -1 ? [label.slice(0, spaceIdx), label.slice(spaceIdx + 1)] : [label];
}

const LABEL_R = R + 11; // label ring radius — slight extra room for stacked lines

// Pale yellow accent — matches the app's light color aesthetic
const PALE_YELLOW = '#F0DFA0';

// Prism fill colors keyed to the dominant skill
const SKILL_COLORS: Record<string, { fill: string; stroke: string; dot: string }> = {
  standup:         { fill: 'rgba(255,190,50,0.25)',  stroke: 'rgba(255,190,50,0.75)',  dot: 'rgba(255,190,50,0.9)'  },
  guard_retention: { fill: 'rgba(50,200,200,0.25)',  stroke: 'rgba(50,200,200,0.75)',  dot: 'rgba(50,200,200,0.9)'  },
  submissions:     { fill: 'rgba(220,90,80,0.25)',   stroke: 'rgba(220,90,80,0.75)',   dot: 'rgba(220,90,80,0.9)'   },
  pin_escapes:     { fill: 'rgba(160,100,220,0.25)', stroke: 'rgba(160,100,220,0.75)', dot: 'rgba(160,100,220,0.9)' },
  guard_passing:   { fill: 'rgba(80,140,220,0.25)',  stroke: 'rgba(80,140,220,0.75)',  dot: 'rgba(80,140,220,0.9)'  },
};
const DEFAULT_COLORS = { fill: 'rgba(111,208,140,0.22)', stroke: 'rgba(176,214,100,0.75)', dot: 'rgba(176,214,100,0.9)' };

type Window = '90d' | 'all';

interface SkillRadarProps {
  sessions: SessionSummary[];
}

export default function SkillRadar({ sessions }: SkillRadarProps) {
  const [window, setWindow] = useState<Window>('90d');
  const [prismRevealed, setPrismRevealed] = useState(false);

  // Filter by time window
  const cutoff = window === '90d'
    ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    : null;

  const filtered = cutoff
    ? sessions.filter(s => new Date(s.date) >= cutoff)
    : sessions;

  // Accumulate hours per skill
  const hoursMap: Record<string, number> = Object.fromEntries(
    SKILL_TAGS.map(({ value }) => [value, 0])
  );
  for (const s of filtered) {
    for (const tag of s.tags ?? []) {
      if (tag in hoursMap) hoursMap[tag] += s.duration / 60;
    }
  }

  const hours = SKILL_TAGS.map(({ value }) => hoursMap[value]);
  const maxHours = Math.max(...hours, 0.001); // avoid ÷0
  const normalized = hours.map(h => h / maxHours);

  const hasData = hours.some(h => h > 0);

  // Dominant skill drives the prism color
  const dominantIndex = hours.indexOf(Math.max(...hours));
  const dominantSkill = hasData ? SKILL_TAGS[dominantIndex].value : null;
  const polygonColors = dominantSkill ? (SKILL_COLORS[dominantSkill] ?? DEFAULT_COLORS) : DEFAULT_COLORS;

  // Build polygon point arrays
  const gridRings = [0.25, 0.5, 0.75, 1].map(t =>
    SKILL_TAGS.map((_, i) => vertex(i, t)) as [number, number][]
  );
  const dataPolygon = SKILL_TAGS.map((_, i) => vertex(i, Math.max(normalized[i], 0.02))) as [number, number][];

  const btnBase = 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';
  const btnActive = 'bg-brand-orange text-white';
  const btnInactive = 'bg-white/10 text-white/60 hover:bg-white/20';

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: '#1a3040',
        border: `1px solid rgba(240,223,160,0.2)`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Skills Span</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-medium" style={{ color: PALE_YELLOW }}>
              The Grappling Prism
            </span>
            {/* How it Works tooltip — unchanged */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-white/40 hover:text-white/70 transition-colors leading-none">
                  <Info size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="font-semibold mb-1">How it Works</p>
                <p className="text-xs leading-relaxed text-popover-foreground/80">
                  This chart maps your total accumulated hours across the five core skills of jiu jitsu.
                  As you log hours in specific categories, your Prism expands outward. If your
                  map looks thin in one direction, it's a visual cue to reallocate your training
                  to broaden your technical footprint.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          {/* Prism icon — hover once to permanently reveal the description */}
          <div className="mt-2 relative flex items-start gap-3">
            <button
              className="flex-shrink-0 transition-opacity leading-none"
              style={{ color: PALE_YELLOW, opacity: prismRevealed ? 0.8 : 0.4 }}
              aria-label="About the Grappling Prism"
              onMouseEnter={() => setPrismRevealed(true)}
            >
              <Triangle size={11} fill="currentColor" strokeWidth={0} />
            </button>
            <p
              className="text-xs leading-relaxed transition-opacity duration-700 ease-in-out"
              style={{ color: `rgba(240,223,160,0.7)`, opacity: prismRevealed ? 1 : 0 }}
            >
              Your training is a single source of effort that refracts into five distinct pillars
              of mastery. The Grappling Prism visualizes the balance of your mat time, revealing
              the unique spectrum of your game.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 mt-0.5">
          {(['90d', 'all'] as Window[]).map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`${btnBase} ${window === w ? btnActive : btnInactive}`}
            >
              {w === '90d' ? 'Last 90 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart + legend side-by-side on wider screens — always visible */}
      <div className="flex flex-col sm:flex-row items-center gap-6">

        {/* SVG radar */}
        <div className="w-full" style={{ maxWidth: 280 }}>
          <svg viewBox="-20 -20 140 140" width="100%" aria-label="Skill radar chart">

            {/* Background */}
            <rect x="-20" y="-20" width="140" height="140" fill="#1a3040" rx="12" />

            {/* Grid rings */}
            {gridRings.map((pts, ri) => (
              <polygon
                key={ri}
                points={toPoints(pts)}
                fill="none"
                stroke={PALE_YELLOW}
                strokeOpacity={ri === 3 ? 0.25 : 0.12}
                strokeWidth="0.5"
              />
            ))}

            {/* Axis spokes */}
            {SKILL_TAGS.map((_, i) => {
              const [x, y] = vertex(i, 1);
              return (
                <line
                  key={i}
                  x1={CX} y1={CY}
                  x2={x} y2={y}
                  stroke={PALE_YELLOW}
                  strokeOpacity="0.18"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Data polygon — color driven by dominant skill */}
            <polygon
              points={toPoints(dataPolygon)}
              fill={polygonColors.fill}
              stroke={polygonColors.stroke}
              strokeWidth="1"
              strokeLinejoin="round"
            />

            {/* Vertex dots */}
            {dataPolygon.map(([x, y], i) => (
              normalized[i] > 0.02 && (
                <circle
                  key={i}
                  cx={x} cy={y} r="1.5"
                  fill={polygonColors.dot}
                />
              )
            ))}

            {/* Labels — stacked for multi-word, bold */}
            {SKILL_TAGS.map(({ label }, i) => {
              const angle = (2 * Math.PI / N) * i - Math.PI / 2;
              const lx = CX + LABEL_R * Math.cos(angle);
              const ly = CY + LABEL_R * Math.sin(angle);
              const { textAnchor, dominantBaseline } = labelAttrs(i);
              const lines = labelLines(label);
              const yOffset = lines.length > 1 ? -3 : 0;
              return (
                <text
                  key={i}
                  x={lx.toFixed(2)}
                  y={(ly + yOffset).toFixed(2)}
                  textAnchor={textAnchor}
                  dominantBaseline={dominantBaseline}
                  fill={PALE_YELLOW}
                  fontSize="5"
                  fontWeight="700"
                  fontFamily="sans-serif"
                >
                  {lines.map((line, li) => (
                    <tspan key={li} x={lx.toFixed(2)} dy={li === 0 ? '0' : '6'}>
                      {line}
                    </tspan>
                  ))}
                </text>
              );
            })}

          </svg>
        </div>

        {/* Skill breakdown list */}
        <div className="flex-1 w-full space-y-3">
          {SKILL_TAGS.map(({ value, label }, i) => {
            const h = hours[i];
            const pct = maxHours > 0 ? (h / maxHours) * 100 : 0;
            return (
              <div key={value}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-bold" style={{ color: PALE_YELLOW }}>
                    {label}
                  </span>
                  <span className="text-xs text-white/40">
                    {h > 0 ? `${h.toFixed(1)}h` : '—'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct > 0 ? 'rgba(111,208,140,0.75)' : 'transparent',
                    }}
                  />
                </div>
              </div>
            );
          })}

          {!hasData && (
            <p className="text-xs text-white/25 italic pt-1">
              No tagged sessions in this window.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
