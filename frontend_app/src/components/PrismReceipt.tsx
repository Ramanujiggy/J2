// PrismReceipt — post-save confirmation that animates in the Prism shape
// derived from the user's chip selections, then auto-dismisses.
//
// Receipt, not dashboard: no metrics, no numbers, no interaction inside the
// Prism. Tap anywhere on the overlay (or wait) to dismiss.

import { useEffect } from 'react';
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

const AUTO_DISMISS_MS = 2600;
const FADE_OUT_MS = 320;

interface Props {
  selections: ChipSelection[];
  onDismiss: () => void;
}

export default function PrismReceipt({ selections, onDismiss }: Props) {
  // Auto-dismiss after a short window. The fade-out itself is CSS-driven via
  // a class flip; the unmount fires when the timer completes.
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  // Vertices the user picked, in pillar-order so connecting lines trace a
  // shape with stable winding (a triangle, line, etc.).
  const activeVertices = VERTICES.filter(v => selections.some(s => s.pillar === v.value));
  const stateOf = (pillar: Pillar): ChipSelection | undefined =>
    selections.find(s => s.pillar === pillar);

  // Edges between consecutive active vertices. Closing edge added if 3+
  // vertices, so a triangle/quad/pentagon traces fully. With 2 it's a single
  // chord; with 1 it's a single point (no edges).
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = [];
  if (activeVertices.length >= 2) {
    for (let i = 0; i < activeVertices.length; i++) {
      const a = activeVertices[i]!;
      const b = activeVertices[(i + 1) % activeVertices.length]!;
      // Skip the closing edge for exactly 2 vertices (would draw the same chord twice).
      if (activeVertices.length === 2 && i === 1) continue;
      edges.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, key: `${a.value}-${b.value}` });
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Session logged"
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
      style={{
        backgroundColor: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: `pr_overlay_in 220ms ease-out, pr_overlay_out ${FADE_OUT_MS}ms ease-in ${AUTO_DISMISS_MS - FADE_OUT_MS}ms forwards`,
      }}
    >
      <div
        className="flex flex-col items-center"
        style={{ animation: 'pr_card_in 320ms cubic-bezier(0.2,0.8,0.2,1)' }}
      >
        <span
          className="font-display text-2xl tracking-wide mb-3"
          style={{
            color: PALE_YELLOW,
            textShadow: '0 0 14px rgba(242,228,168,0.45), 0 0 30px rgba(242,228,168,0.18)',
            animation: 'pr_text_in 400ms ease-out 80ms backwards',
          }}
        >
          Logged
        </span>

        <svg
          viewBox="0 -16 240 246"
          width="280"
          style={{ overflow: 'visible' }}
          aria-hidden
        >
          {/* Faint pentagon outline — establishes the Prism context */}
          <polygon
            points={POLYGON_POINTS}
            fill="rgba(21,46,34,0.55)"
            stroke="rgba(196,145,95,0.22)"
            strokeWidth={1.2}
            style={{ animation: 'pr_fade_in 360ms ease-out 120ms backwards' }}
          />

          {/* Spokes — center to each selected vertex. Drawn before edges so
              the shape's body sits visually above them. */}
          {activeVertices.map((v, i) => (
            <line
              key={`spoke-${v.value}`}
              x1={CX} y1={CY} x2={v.cx} y2={v.cy}
              stroke="rgba(196,145,95,0.30)"
              strokeWidth={1}
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={100}
              style={{ animation: `pr_draw 360ms ease-out ${380 + i * 90}ms forwards` }}
            />
          ))}

          {/* Edges between active vertices — staggered draw-in. */}
          {edges.map((e, i) => (
            <line
              key={`edge-${e.key}`}
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={PALE_YELLOW}
              strokeWidth={1.8}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={100}
              style={{
                animation: `pr_draw 380ms ease-out ${600 + i * 110}ms forwards`,
                filter: 'drop-shadow(0 0 4px rgba(242,228,168,0.35))',
              }}
            />
          ))}

          {/* Vertex markers — pop in at the end. */}
          {VERTICES.map((v, i) => {
            const sel = stateOf(v.value);
            const isPrimary = !!sel?.primary;
            const isDeepWork = !!sel?.deep_work;
            const radius = sel ? (isPrimary ? 6 : 4.5) : 2.5;
            const fill = sel ? (isPrimary ? PALE_YELLOW : COPPER) : 'rgba(196,145,95,0.25)';
            const popDelay = 800 + edges.length * 110 + i * 60;
            return (
              <g key={`v-${v.value}`} style={{ animation: `pr_pop ${sel ? 320 : 240}ms cubic-bezier(0.2,0.8,0.2,1) ${popDelay}ms backwards`, transformOrigin: `${v.cx}px ${v.cy}px` }}>
                {/* Halo for deep-work */}
                {isDeepWork && (
                  <circle
                    cx={v.cx} cy={v.cy} r={radius + 4}
                    fill="none"
                    stroke="rgba(196,145,95,0.55)"
                    strokeWidth={1.4}
                  />
                )}
                {/* Primary glow */}
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

          {/* Vertex labels — selected ones bright, others dim. */}
          {VERTICES.map((v, i) => {
            const sel = stateOf(v.value);
            const labelDelay = 950 + edges.length * 110 + i * 60;
            return (
              <text
                key={`l-${v.value}`}
                x={v.lx} y={v.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10.5}
                style={{
                  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                  fontWeight: sel ? 600 : 400,
                  fill: sel ? PALE_YELLOW : 'rgba(255,255,255,0.30)',
                  letterSpacing: '0.04em',
                  animation: `pr_fade_in 280ms ease-out ${labelDelay}ms backwards`,
                }}
              >
                {v.label}
              </text>
            );
          })}
        </svg>

        <span
          className="text-[11px] mt-4"
          style={{ color: 'rgba(255,255,255,0.40)', animation: 'pr_fade_in 400ms ease-out 1400ms backwards' }}
        >
          tap to dismiss
        </span>
      </div>

      <style>{`
        @keyframes pr_overlay_in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pr_overlay_out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes pr_card_in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes pr_text_in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pr_fade_in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pr_draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes pr_pop {
          0%   { opacity: 0; transform: scale(0.4); }
          70%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1);    }
        }
      `}</style>
    </div>
  );
}
