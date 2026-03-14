import { useState } from 'react';
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

const LABEL_R = R + 10; // label ring radius

// Pale yellow accent — matches the app's light color aesthetic
const PALE_YELLOW = '#F0DFA0';

type Window = '90d' | 'all';

interface SkillRadarProps {
  sessions: SessionSummary[];
}

export default function SkillRadar({ sessions }: SkillRadarProps) {
  const [window, setWindow] = useState<Window>('90d');

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Skill Focus</h2>
        <div className="flex gap-2">
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

      {/* Chart + legend side-by-side on wider screens */}
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

            {/* Data polygon */}
            <polygon
              points={toPoints(dataPolygon)}
              fill="rgba(111,208,140,0.22)"
              stroke="rgba(176,214,100,0.75)"
              strokeWidth="1"
              strokeLinejoin="round"
            />

            {/* Vertex dots */}
            {dataPolygon.map(([x, y], i) => (
              normalized[i] > 0.02 && (
                <circle
                  key={i}
                  cx={x} cy={y} r="1.5"
                  fill="rgba(176,214,100,0.9)"
                />
              )
            ))}

            {/* Labels */}
            {SKILL_TAGS.map(({ label }, i) => {
              const angle = (2 * Math.PI / N) * i - Math.PI / 2;
              const lx = CX + LABEL_R * Math.cos(angle);
              const ly = CY + LABEL_R * Math.sin(angle);
              const { textAnchor, dominantBaseline } = labelAttrs(i);
              return (
                <text
                  key={i}
                  x={lx.toFixed(2)}
                  y={ly.toFixed(2)}
                  textAnchor={textAnchor}
                  dominantBaseline={dominantBaseline}
                  fill={PALE_YELLOW}
                  fontSize="5"
                  fontWeight="500"
                  fontFamily="sans-serif"
                >
                  {label}
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
                  <span className="text-xs font-medium" style={{ color: PALE_YELLOW }}>
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
