// BeltBar — renders a BJJ belt accent bar sized to its parent width.
// Main belt colour on the left, a dark stripe patch on the right,
// with thin white stripe bars for each degree (0–4).
// Animates from left: unfurls to full width when first mounted.

import { useState, useEffect } from 'react';

export type BeltRank = 'white' | 'blue' | 'purple' | 'brown' | 'black';

export const BELT_COLORS: Record<BeltRank, string> = {
  white:  '#C8C4BF',  // off-white — visible on dark background
  blue:   '#1E4D8C',
  purple: '#6B2D8B',
  brown:  '#7B4A2D',
  black:  '#1C1C1C',  // near-black — distinct from app background
};

// Patch color per rank — black belt gets a red patch, all others near-black.
export const PATCH_COLORS: Record<BeltRank, string> = {
  white:  '#0D0D0D',
  blue:   '#0D0D0D',
  purple: '#0D0D0D',
  brown:  '#0D0D0D',
  black:  '#C41E3A',
};

interface BeltBarProps {
  rank?: string | null;
  stripes?: number;
}

export default function BeltBar({ rank, stripes = 0 }: BeltBarProps) {
  const beltRank = rank as BeltRank | null;
  const beltColor = beltRank ? (BELT_COLORS[beltRank] ?? null) : null;
  const patchColor = beltRank ? (PATCH_COLORS[beltRank] ?? '#0D0D0D') : '#0D0D0D';

  // Don't render anything until a rank is set.
  if (!beltColor) return null;

  const clampedStripes = Math.min(Math.max(Math.round(stripes), 0), 4);

  return <BeltBarInner beltColor={beltColor} patchColor={patchColor} stripes={clampedStripes} />;
}

// Animation constants
const ROLL_D    = 20;  // px — diameter of the rolling circle (visible belt roll cross-section)
const BELT_H    = 10;  // px — final flat belt height (more rectangular than before)
const ROLL_MS   = 680; // ms — belt rolls across
const SETTLE_MS = 200; // ms — belt squishes flat
const SPARK_MS  = 380; // ms — ~ and ! are visible

// Easing: spring with slight overshoot at the end, like a belt snapping flat
const SPRING = 'cubic-bezier(0.34, 1.3, 0.64, 1)';

function BeltBarInner({
  beltColor,
  patchColor,
  stripes,
}: {
  beltColor: string;
  patchColor: string;
  stripes: number;
}) {
  // idle     → waiting to start
  // rolling  → circle moves right, flat belt extends behind it
  // settling → circle fades out, belt squishes to final height
  // sparks   → ~ and ! float up from the right end
  // done     → clean final state
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'settling' | 'sparks' | 'done'>('idle');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('rolling'),  40);
    const t2 = setTimeout(() => setPhase('settling'), 40 + ROLL_MS);
    const t3 = setTimeout(() => setPhase('sparks'),   40 + ROLL_MS + SETTLE_MS);
    const t4 = setTimeout(() => setPhase('done'),     40 + ROLL_MS + SETTLE_MS + SPARK_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const flat    = phase === 'settling' || phase === 'sparks' || phase === 'done';
  const rolling = phase === 'rolling';

  // Belt max-width:
  //   idle     → 0 (nothing visible yet)
  //   rolling  → calc(100% - ROLL_D) — leaves room for the circle at the right edge
  //   settling → 100% — fills the last gap as circle fades
  const beltMaxWidth =
    phase === 'idle'    ? 0 :
    flat                ? '100%' :
    `calc(100% - ${ROLL_D}px)`;

  const beltTransition =
    rolling ? `max-width ${ROLL_MS}ms ${SPRING}` :
    phase === 'settling' ? `max-width ${SETTLE_MS}ms ease, height ${SETTLE_MS}ms ease, border-radius ${SETTLE_MS}ms ease` :
    'none';

  // Circle: shown during idle, rolling, and settling (fades out during settling)
  const showCircle   = phase === 'idle' || phase === 'rolling' || phase === 'settling';
  const circleLeft   = (rolling || phase === 'settling') ? `calc(100% - ${ROLL_D}px)` : '0';
  const circleOpacity = phase === 'settling' ? 0 : 1;

  const circleTransition =
    rolling          ? `left ${ROLL_MS}ms ${SPRING}` :
    phase === 'settling' ? `opacity ${SETTLE_MS}ms ease` :
    'none';

  return (
    <>
      {/* Keyframe animations — injected once; scoped by unique names */}
      <style>{`
        @keyframes j2BeltSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(720deg); }
        }
        @keyframes j2BeltTilde {
          0%   { opacity: 0; transform: translate(0, -50%); }
          15%  { opacity: 1; }
          80%  { opacity: 0.85; }
          100% { opacity: 0; transform: translate(-6px, -260%); }
        }
        @keyframes j2BeltBang {
          0%   { opacity: 0; transform: translate(0, -50%); }
          20%  { opacity: 1; }
          80%  { opacity: 0.85; }
          100% { opacity: 0; transform: translate(4px, -300%); }
        }
      `}</style>

      {/* Fixed-height container — nav bar height stays constant throughout animation */}
      <div style={{ position: 'relative', height: ROLL_D, marginTop: 3 }}>

        {/* ── Flat belt ── extends left-to-right behind the rolling circle */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '100%',
          maxWidth: beltMaxWidth,
          // Height: full ROLL_D during rolling so it aligns with circle; squishes to BELT_H when flat
          height: flat ? BELT_H : ROLL_D,
          borderRadius: flat ? 2 : ROLL_D / 2,
          overflow: 'hidden',
          display: 'flex',
          transition: beltTransition,
        }}>
          {/* Main belt colour */}
          <div style={{ flex: 1, backgroundColor: beltColor }} />
          {/* Stripe patch */}
          <div style={{ width: '22%', backgroundColor: patchColor, position: 'relative', flexShrink: 0 }}>
            {Array.from({ length: stripes }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: 0, bottom: 0,
                width: '2px',
                backgroundColor: '#FFFFFF',
                left: `${((i + 1) / (stripes + 1)) * 100}%`,
                transform: 'translateX(-50%)',
                opacity: flat ? 1 : 0,
                transition: flat ? `opacity 0.2s ease ${i * 80}ms` : 'none',
              }} />
            ))}
          </div>
        </div>

        {/* ── Rolling circle ── represents the cross-section of the coiled belt */}
        {showCircle && (
          <div style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: circleLeft,
            opacity: circleOpacity,
            width: ROLL_D,
            height: ROLL_D,
            borderRadius: '50%',
            backgroundColor: beltColor,
            // Concentric rings suggest the layered cross-section of a rolled belt
            boxShadow: `
              inset 0 0 0 3px   rgba(0,0,0,0.28),
              inset 0 0 0 5px   ${beltColor},
              inset 0 0 0 6.5px rgba(0,0,0,0.18),
              inset 0 0 0 8px   ${beltColor}88
            `,
            zIndex: 2,
            transition: circleTransition,
            overflow: 'hidden',
          }}>
            {/* Spinning dashed inner ring — visual cue that it's rotating */}
            <div style={{
              position: 'absolute',
              inset: '3px',
              borderRadius: '50%',
              border: '1.5px dashed rgba(255,255,255,0.22)',
              animation: rolling ? `j2BeltSpin ${ROLL_MS}ms linear forwards` : 'none',
            }} />
          </div>
        )}

        {/* ── Sparks ── tilde and exclamation burst out of the right end */}
        <span style={{
          position: 'absolute',
          right: '4px',
          top: '50%',
          fontSize: '10px',
          fontWeight: 900,
          color: '#F0DFA0',
          opacity: 0,
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 4,
          animation: phase === 'sparks' ? `j2BeltTilde ${SPARK_MS}ms ease forwards` : 'none',
        }}>~</span>

        <span style={{
          position: 'absolute',
          right: '-2px',
          top: '50%',
          fontSize: '10px',
          fontWeight: 900,
          color: '#F0DFA0',
          opacity: 0,
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 4,
          animation: phase === 'sparks' ? `j2BeltBang ${SPARK_MS}ms ease forwards` : 'none',
        }}>!</span>

      </div>
    </>
  );
}
