// PrismShape — static, non-interactive Prism visualization derived from a
// list of chip selections. Used as the "pokedex" side panel beside
// FocusAreaChips: as the user taps chips, the shape updates live.
//
// No animations, no overlay, no auto-dismiss. For the animated post-save
// receipt see PrismReceipt.

import { COPPER, PALE_YELLOW } from '../lib/theme.ts';
import type { ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Pillar } from '../types/api.ts';

const CX = 120;
const CY = 115;
const R  = 88;

const PILLAR_ORDER: ReadonlyArray<{ value: Pillar; label: string }> = [
  { value: 'standup',     label: 'Stand-up' },
  { value: 'passing',     label: 'Passing' },
  { value: 'pins',        label: 'Pins' },
  { value: 'submissions', label: 'Subs' },
  { value: 'guard',       label: 'Guard' },
];

const VERTICES = PILLAR_ORDER.map((p, i) => {
  const angle = ((-90 + i * 72) * Math.PI) / 180;
  return {
    ...p,
    cx: CX + R * Math.cos(angle),
    cy: CY + R * Math.sin(angle),
    lx: CX + (R + 22) * Math.cos(angle),
    ly: CY + (R + 22) * Math.sin(angle),
  };
});

const POLYGON_POINTS = VERTICES.map(v => `${v.cx.toFixed(1)},${v.cy.toFixed(1)}`).join(' ');

interface Props {
  selections: ChipSelection[];
  /** SVG render width in CSS pixels. Defaults to 200. */
  size?: number;
  /** Whether to render the pillar labels around the perimeter. Defaults to true. */
  showLabels?: boolean;
}

export default function PrismShape({ selections, size = 200, showLabels = true }: Props) {
  const activeVertices = VERTICES.filter(v => selections.some(s => s.pillar === v.value));
  const stateOf = (pillar: Pillar): ChipSelection | undefined =>
    selections.find(s => s.pillar === pillar);

  // Edges between consecutive active vertices in pillar-order.
  // 1 selection → no edges. 2 → one chord. 3+ → closed polygon.
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = [];
  if (activeVertices.length >= 2) {
    for (let i = 0; i < activeVertices.length; i++) {
      const a = activeVertices[i]!;
      const b = activeVertices[(i + 1) % activeVertices.length]!;
      if (activeVertices.length === 2 && i === 1) continue;
      edges.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, key: `${a.value}-${b.value}` });
    }
  }

  return (
    <svg
      viewBox={showLabels ? '0 -16 240 246' : '16 16 208 198'}
      width={size}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden
    >
      {/* Faint pentagon outline */}
      <polygon
        points={POLYGON_POINTS}
        fill="rgba(21,46,34,0.55)"
        stroke="rgba(196,145,95,0.22)"
        strokeWidth={1.2}
      />

      {/* Spokes — center to each selected vertex */}
      {activeVertices.map(v => (
        <line
          key={`spoke-${v.value}`}
          x1={CX} y1={CY} x2={v.cx} y2={v.cy}
          stroke="rgba(196,145,95,0.30)"
          strokeWidth={1}
        />
      ))}

      {/* Edges between active vertices — the user's shape */}
      {edges.map(e => (
        <line
          key={`edge-${e.key}`}
          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke={PALE_YELLOW}
          strokeWidth={1.6}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(242,228,168,0.30))' }}
        />
      ))}

      {/* Vertex markers */}
      {VERTICES.map(v => {
        const sel = stateOf(v.value);
        const isPrimary = !!sel?.primary;
        const isDeepWork = !!sel?.deep_work;
        const radius = sel ? (isPrimary ? 5.5 : 4) : 2.2;
        const fill = sel ? (isPrimary ? PALE_YELLOW : COPPER) : 'rgba(196,145,95,0.22)';
        return (
          <g key={`v-${v.value}`}>
            {isDeepWork && (
              <circle
                cx={v.cx} cy={v.cy} r={radius + 3.5}
                fill="none"
                stroke="rgba(196,145,95,0.55)"
                strokeWidth={1.2}
              />
            )}
            {isPrimary && (
              <circle
                cx={v.cx} cy={v.cy} r={radius + 2}
                fill="rgba(242,228,168,0.18)"
              />
            )}
            <circle cx={v.cx} cy={v.cy} r={radius} fill={fill} />
          </g>
        );
      })}

      {/* Vertex labels */}
      {showLabels && VERTICES.map(v => {
        const sel = stateOf(v.value);
        return (
          <text
            key={`l-${v.value}`}
            x={v.lx} y={v.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9.5}
            style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontWeight: sel ? 600 : 400,
              fill: sel ? PALE_YELLOW : 'rgba(255,255,255,0.28)',
              letterSpacing: '0.04em',
            }}
          >
            {v.label}
          </text>
        );
      })}
    </svg>
  );
}
