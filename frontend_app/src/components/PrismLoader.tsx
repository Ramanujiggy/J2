// PrismLoader — looping Prism-trace animation used as the app's mobile loading
// indicator. Replaces the prior BeltLoader belt-tying animation. The Prism is
// the brand's load-bearing visual identity (Atlas Analytics, post-save
// PrismReceipt, marketing); pages booting up should feel like the Prism
// arriving rather than a belt being tied.
//
// Cycle (~2.5s):
//   1. Center core fades in (0–200ms)
//   2. Pentagon strokes draw via stroke-dashoffset (200–1100ms)
//   3. Vertex dots pop one-by-one as the trace reaches each (200, 380, 560, 740, 920ms)
//   4. Hold with slow breathing glow (1100–1900ms)
//   5. Fade out + slight scale-pull (1900–2500ms)
//   6. Loop
//
// Geometry mirrors PrismReceipt so the loader and post-save receipt visually
// rhyme. Same five vertices in pillar order (standup → passing → pins →
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

// Side length = 2 * R * sin(π/5); perimeter = 5 sides.
// Slight overshoot on dasharray so the closing edge fully covers without a gap.
const PERIMETER = Math.ceil(5 * 2 * R * Math.sin(Math.PI / 5)) + 4;

// Pacing constants — matches the comment block at top.
const CORE_IN_MS    = 200;
const TRACE_MS      = 900;
const VERTEX_STEP_MS = 180;          // 5 vertices × 180ms ≈ 900ms trace
const VERTEX_POP_MS = 320;
const HOLD_MS       = 800;
const FADE_OUT_MS   = 600;
const CYCLE_MS      = CORE_IN_MS + TRACE_MS + HOLD_MS + FADE_OUT_MS;  // 2500ms
const SETTLE_MS     = CORE_IN_MS + TRACE_MS + HOLD_MS;                // 1900ms — end of hold

interface PrismLoaderProps {
  /** Called at the end of each cycle's hold phase. PageContent uses this to
   *  schedule its crossfade at a settled visual moment. */
  onCycleSettle?: () => void;
}

export default function PrismLoader({ onCycleSettle }: PrismLoaderProps) {
  // Re-keying forces a clean restart of all CSS animations each cycle.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const settleTimer = setTimeout(() => {
      if (onCycleSettle) onCycleSettle();
    }, SETTLE_MS);
    const restartTimer = setTimeout(() => {
      setCycle(c => c + 1);
    }, CYCLE_MS);
    return () => {
      clearTimeout(settleTimer);
      clearTimeout(restartTimer);
    };
  }, [cycle, onCycleSettle]);

  return (
    <div
      key={cycle}
      style={{
        position: 'relative',
        width: 240,
        height: 230,
        animation: `pl_cycle ${CYCLE_MS}ms linear forwards`,
      }}
    >
      <style>{`
        /* Whole-loader cycle — handles the fade-out at the end of the loop. */
        @keyframes pl_cycle {
          0%, ${((CYCLE_MS - FADE_OUT_MS) / CYCLE_MS) * 100}% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.97);
          }
        }
        /* Pentagon stroke draws in via stroke-dashoffset. */
        @keyframes pl_trace {
          from { stroke-dashoffset: ${PERIMETER}; }
          to   { stroke-dashoffset: 0; }
        }
        /* Center core fades in at start. */
        @keyframes pl_core_in {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        /* Each vertex pops with a slight overshoot. */
        @keyframes pl_vertex_pop {
          0%   { opacity: 0; transform: scale(0); }
          60%  { opacity: 1; transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
        /* Held pentagon breathes — drop-shadow glow oscillates. */
        @keyframes pl_breathe {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(242,228,168,0.28)); }
          50%      { filter: drop-shadow(0 0 14px rgba(242,228,168,0.55)); }
        }
      `}</style>

      <svg
        viewBox="0 0 240 230"
        width="240"
        height="230"
        style={{ overflow: 'visible' }}
      >
        {/* Ambient backdrop — faint copper radial glow. Atmospheric, sits
            below the Prism, doesn't compete with the trace. */}
        <defs>
          <radialGradient id="pl_ambient" cx="50%" cy="52%" r="55%">
            <stop offset="0%"  stopColor={COPPER}      stopOpacity="0.10" />
            <stop offset="60%" stopColor={COPPER}      stopOpacity="0.04" />
            <stop offset="100%" stopColor={PALE_YELLOW} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R + 28} fill="url(#pl_ambient)" />

        {/* Pentagon stroke — draws in from start to closing edge over TRACE_MS.
            Held at full pentagon during HOLD_MS with a breathing glow on top
            of the trace fill (transparent, so only the stroke breathes). */}
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
            animation: `
              pl_trace ${TRACE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${CORE_IN_MS}ms forwards,
              pl_breathe 1800ms ease-in-out ${CORE_IN_MS + TRACE_MS}ms infinite
            `,
          }}
        />

        {/* Vertex dots — pop one at a time as the trace reaches each. The pops
            land at 200, 380, 560, 740, 920 ms (CORE_IN_MS + i * VERTEX_STEP_MS). */}
        {VERTICES.map((v, i) => (
          <circle
            key={i}
            cx={v.cx}
            cy={v.cy}
            r={5}
            fill={COPPER}
            opacity={0}
            style={{
              transformOrigin: `${v.cx}px ${v.cy}px`,
              animation: `pl_vertex_pop ${VERTEX_POP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${CORE_IN_MS + i * VERTEX_STEP_MS}ms forwards`,
              filter: 'drop-shadow(0 0 6px rgba(242,228,168,0.45))',
            }}
          />
        ))}

        {/* Center core — fades in at the very start, sits as the Prism's heart. */}
        <circle
          cx={CX}
          cy={CY}
          r={3}
          fill={PALE_YELLOW}
          opacity={0}
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            animation: `pl_core_in ${CORE_IN_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            filter: 'drop-shadow(0 0 5px rgba(242,228,168,0.6))',
          }}
        />
      </svg>
    </div>
  );
}
