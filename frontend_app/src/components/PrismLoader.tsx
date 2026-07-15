// PrismLoader — Prism arrival + patience loop, the app's loading indicator.
//
// Motion vocabulary (2026-06-28 motion study): loading has TWO tempos, not a
// looping cycle —
//
//   1. ARRIVE (once, ~1.3s): center core fades in, the pentagon traces closed
//      via stroke-dashoffset, and vertex dots pop in pillar order as the line
//      reaches each. Same geometry + pacing as the original trace loop.
//   2. SWEEP (infinite): the traced stroke settles to a ghost and a comet of
//      light circles the perimeter (3s per lap, linear), flaring each vertex
//      as it passes. No fade-out, no restart — a long wait reads as patience,
//      not as the app rebooting every 2.5 seconds.
//
// `onCycleSettle` fires once at the end of ARRIVE and then on every vertex
// flare (600ms cadence), so PageContent can crossfade at a settled moment
// almost as soon as data is ready. Reduced-motion users get the static
// pentagon at rest with immediate settles.
//
// Geometry mirrors PrismReceipt so the loader and post-save receipt visually
// rhyme: five vertices in pillar order (standup → passing → pins →
// submissions → guard) at 72° apart starting from -90° (12 o'clock).

import { useEffect, useState } from 'react';
import { COPPER, PALE_YELLOW } from '../lib/theme.ts';

// ── Geometry (parallel to PrismReceipt.tsx:12-35) ──
const CX = 120;
const CY = 115;
const R  = 88;

const PILLAR_ORDER = ['standup', 'passing', 'pins', 'submissions', 'guard'] as const;

const VERTICES = PILLAR_ORDER.map((_, i) => {
  const angle = ((-90 + i * 72) * Math.PI) / 180;
  return {
    cx: CX + R * Math.cos(angle),
    cy: CY + R * Math.sin(angle),
  };
});

const POLYGON_POINTS = VERTICES.map(v => `${v.cx.toFixed(2)},${v.cy.toFixed(2)}`).join(' ');

// Side length = 2 * R * sin(π/5); perimeter = 5 sides. Slight overshoot on the
// dash budget so the closing edge fully covers without a gap. The sweep's
// dasharray (comet + gap) sums to the same budget so one lap = one pattern
// shift = a seamless loop.
const PERIMETER = Math.ceil(5 * 2 * R * Math.sin(Math.PI / 5)) + 4;
const COMET_LEN = 96;
const COMET_GAP = PERIMETER - COMET_LEN;

// ── Pacing ──
const CORE_IN_MS     = 200;
const TRACE_MS       = 900;
const VERTEX_STEP_MS = 180;   // 5 vertices × 180ms ≈ 900ms trace
const VERTEX_POP_MS  = 320;
const ARRIVE_MS      = CORE_IN_MS + TRACE_MS + 200;  // brief beat after the close
const SWEEP_LAP_MS   = 3000;
const FLARE_STEP_MS  = SWEEP_LAP_MS / 5;             // 600ms — comet cadence + settle cadence

interface PrismLoaderProps {
  /** Fired at the end of ARRIVE and on every sweep vertex-flare thereafter.
   *  PageContent uses this to schedule its crossfade at a settled moment. */
  onCycleSettle?: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PrismLoader({ onCycleSettle }: PrismLoaderProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<'arrive' | 'sweep'>(reduced ? 'sweep' : 'arrive');

  // ARRIVE → SWEEP handoff + settle cadence.
  useEffect(() => {
    if (reduced) {
      // Static pentagon — any moment is a settled moment.
      const first = setTimeout(() => onCycleSettle?.(), 50);
      const beat = setInterval(() => onCycleSettle?.(), FLARE_STEP_MS);
      return () => { clearTimeout(first); clearInterval(beat); };
    }
    const toSweep = setTimeout(() => {
      setPhase('sweep');
      onCycleSettle?.();
    }, ARRIVE_MS);
    return () => clearTimeout(toSweep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (reduced || phase !== 'sweep') return;
    const beat = setInterval(() => onCycleSettle?.(), FLARE_STEP_MS);
    return () => clearInterval(beat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  return (
    <div style={{ position: 'relative', width: 240, height: 230 }}>
      <style>{`
        /* ── ARRIVE ── */
        @keyframes pl_trace {
          from { stroke-dashoffset: ${PERIMETER}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes pl_core_in {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes pl_vertex_pop {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
        /* ── SWEEP ── */
        @keyframes pl_ghost_settle {
          from { stroke-opacity: 1; }
          to   { stroke-opacity: 0.16; }
        }
        @keyframes pl_comet {
          from { stroke-dashoffset: ${PERIMETER}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes pl_comet_in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pl_flare {
          0%, 12%   { opacity: 0.35; transform: scale(1); }
          6%        { opacity: 1;    transform: scale(1.45); }
          100%      { opacity: 0.35; transform: scale(1); }
        }
      `}</style>

      <svg viewBox="0 0 240 230" width="240" height="230" style={{ overflow: 'visible' }}>
        {/* Ambient backdrop — faint copper radial glow beneath everything. */}
        <defs>
          <radialGradient id="pl_ambient" cx="50%" cy="52%" r="55%">
            <stop offset="0%"   stopColor={COPPER}      stopOpacity="0.10" />
            <stop offset="60%"  stopColor={COPPER}      stopOpacity="0.04" />
            <stop offset="100%" stopColor={PALE_YELLOW} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R + 28} fill="url(#pl_ambient)" />

        {phase === 'arrive' ? (
          <>
            {/* Pentagon traces itself closed, once. */}
            <polygon
              points={POLYGON_POINTS}
              fill="none"
              stroke={PALE_YELLOW}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={PERIMETER}
              strokeDashoffset={PERIMETER}
              style={{
                animation: `pl_trace ${TRACE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${CORE_IN_MS}ms forwards`,
              }}
            />
            {/* Vertex dots pop as the trace reaches each. */}
            {VERTICES.map((v, i) => (
              <circle
                key={i}
                cx={v.cx}
                cy={v.cy}
                r={5}
                fill={COPPER}
                opacity={0}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `pl_vertex_pop ${VERTEX_POP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${CORE_IN_MS + i * VERTEX_STEP_MS}ms forwards`,
                  filter: 'drop-shadow(0 0 6px rgba(242,228,168,0.45))',
                }}
              />
            ))}
            {/* Center core — the Prism's heart, in first. */}
            <circle
              cx={CX}
              cy={CY}
              r={3}
              fill={PALE_YELLOW}
              opacity={0}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: `pl_core_in ${CORE_IN_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                filter: 'drop-shadow(0 0 5px rgba(242,228,168,0.6))',
              }}
            />
          </>
        ) : (
          <>
            {/* Traced stroke settles to a ghost (skips the settle animation
                for reduced-motion users, who land here directly at rest). */}
            <polygon
              points={POLYGON_POINTS}
              fill="none"
              stroke={PALE_YELLOW}
              strokeOpacity={reduced ? 0.85 : 0.16}
              strokeWidth={reduced ? 1.8 : 1.2}
              strokeLinejoin="round"
              style={reduced ? undefined : { animation: 'pl_ghost_settle 500ms ease-out both' }}
            />
            {!reduced && (
              /* The comet — circles the perimeter forever, no reset. */
              <polygon
                points={POLYGON_POINTS}
                fill="none"
                stroke={PALE_YELLOW}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={`${COMET_LEN} ${COMET_GAP}`}
                strokeDashoffset={PERIMETER}
                style={{
                  animation: `pl_comet ${SWEEP_LAP_MS}ms linear infinite, pl_comet_in 300ms ease-out both`,
                  filter: 'drop-shadow(0 0 6px rgba(242,228,168,0.5))',
                }}
              />
            )}
            {/* Vertices flare as the comet passes — 600ms cadence in pillar order. */}
            {VERTICES.map((v, i) => (
              <circle
                key={i}
                cx={v.cx}
                cy={v.cy}
                r={4}
                fill={COPPER}
                opacity={reduced ? 0.8 : 0.35}
                style={reduced ? undefined : {
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `pl_flare ${SWEEP_LAP_MS}ms linear ${i * FLARE_STEP_MS}ms infinite`,
                  filter: 'drop-shadow(0 0 6px rgba(242,228,168,0.45))',
                }}
              />
            ))}
            <circle cx={CX} cy={CY} r={2.5} fill={PALE_YELLOW} opacity={0.5} />
          </>
        )}
      </svg>
    </div>
  );
}
