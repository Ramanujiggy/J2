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

// Pacing — the receipt's whole purpose is to give the user a moment to *see*
// the shape they just made. Earlier values rushed past the finished frame.
// New numbers leave ~1.5–2 s of "settled" viewing after the last vertex/label
// pops in (5-selection case lands the final label around 2.6 s; auto-dismiss
// fires at 5 s).
const AUTO_DISMISS_MS = 5000;
const FADE_OUT_MS = 360;

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
      {/* Top-right dismiss — replaces the old "tap to dismiss" footer text.
          Standard close affordance, doesn't pull the eye while the shape draws. */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        style={{
          position: 'fixed',
          top: 'max(20px, env(safe-area-inset-top))',
          right: 'max(20px, env(safe-area-inset-right))',
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.16)',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.75)',
          fontSize: 20,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
          animation: 'pr_fade_in 360ms ease-out 200ms backwards',
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.95)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.30)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
        }}
      >
        ×
      </button>

      <div
        className="flex flex-col items-center"
        style={{ animation: 'pr_card_in 380ms cubic-bezier(0.2,0.8,0.2,1)' }}
      >
        <span
          className="font-display text-2xl tracking-wide mb-3"
          style={{
            color: PALE_YELLOW,
            textShadow: '0 0 14px rgba(242,228,168,0.45), 0 0 30px rgba(242,228,168,0.18)',
            animation: 'pr_text_in 480ms ease-out 80ms backwards',
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
            style={{ animation: 'pr_fade_in 460ms ease-out 140ms backwards' }}
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
              style={{ animation: `pr_draw 480ms ease-out ${460 + i * 130}ms forwards` }}
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
                animation: `pr_draw 520ms ease-out ${740 + i * 160}ms forwards`,
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
            const popDelay = 1000 + edges.length * 160 + i * 90;
            return (
              <g key={`v-${v.value}`} style={{ animation: `pr_pop ${sel ? 380 : 300}ms cubic-bezier(0.2,0.8,0.2,1) ${popDelay}ms backwards`, transformOrigin: `${v.cx}px ${v.cy}px` }}>
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
            const labelDelay = 1180 + edges.length * 160 + i * 90;
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
                  animation: `pr_fade_in 360ms ease-out ${labelDelay}ms backwards`,
                }}
              >
                {v.label}
              </text>
            );
          })}
        </svg>
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
