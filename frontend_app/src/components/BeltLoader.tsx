// BeltLoader — looping belt-tying animation used as the app's loading indicator.
// Renders a larger version of the BeltBar tying sequence that loops continuously:
// slide in → knot forms → tails drop → sparks → hold → fade out → repeat.

import { useState, useEffect } from 'react';
import { type BeltRank, BELT_COLORS, PATCH_COLORS, ribbed } from '../lib/belt.ts';

// ── Default colour (copper/gold) when no rank is provided ──────────────────
const DEFAULT_BELT  = '#C4915F';
const DEFAULT_PATCH = '#0D0D0D';

// ── Timing (ms) ────────────────────────────────────────────────────────────
const SLIDE_MS   = 500;
const KNOT_D     =  65;
const KNOT_MS    = 300;
const TAIL_D     = 120;
const TAIL_MS    = 480;
const TAIL_R_LAG =  52;
const SPARK_D    = 270;
const SPARK_MS   = 380;
const HOLD_MS    = 1000;
const FADE_MS    = 350;
const GAP_MS     = 150;

// ── Dimensions (scaled ~3.5x from header BeltBar) ─────────────────────────
const BELT_W    = 240;
const BELT_H    =  48;
const STRIP_W   =  88;
const STRIP_H   =  48;
const STRIP_ANG =  22;
const KNOT_C_W  = 108;
const KNOT_C_H  =  88;
const TAIL_W    =  34;
const TAIL_H    =  96;
const PATCH_PCT =  62;
const TIP_PCT   =   9;

interface BeltLoaderProps {
  rank?: BeltRank | null;
  stripes?: number;
  /** Called at the end of each tying cycle (after hold, before fade). */
  onCycleSettle?: () => void;
}

export default function BeltLoader({ rank, stripes = 0, onCycleSettle }: BeltLoaderProps) {
  const beltColor  = rank ? (BELT_COLORS[rank] ?? DEFAULT_BELT) : DEFAULT_BELT;
  const patchColor = rank ? (PATCH_COLORS[rank] ?? DEFAULT_PATCH) : DEFAULT_PATCH;
  const clampedStripes = rank ? Math.min(Math.max(Math.round(stripes), 0), 4) : 0;

  return <BeltLoaderInner beltColor={beltColor} patchColor={patchColor} stripes={clampedStripes} onCycleSettle={onCycleSettle} />;
}

function BeltLoaderInner({
  beltColor,
  patchColor,
  stripes,
  onCycleSettle,
}: {
  beltColor: string;
  patchColor: string;
  stripes: number;
  onCycleSettle?: () => void;
}) {
  const [slideIn,  setSlideIn]  = useState(false);
  const [knotIn,   setKnotIn]   = useState(false);
  const [tailsIn,  setTailsIn]  = useState(false);
  const [sparksIn, setSparksIn] = useState(false);
  const [fading,   setFading]   = useState(false);
  const [cycle,    setCycle]    = useState(0);

  useEffect(() => {
    const d = 40;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };

    // Tying sequence
    at(() => setSlideIn(true),   d);
    at(() => setKnotIn(true),    d + SLIDE_MS + KNOT_D);
    at(() => setTailsIn(true),   d + SLIDE_MS + TAIL_D);
    at(() => setSparksIn(true),  d + SLIDE_MS + SPARK_D);
    at(() => setSparksIn(false), d + SLIDE_MS + SPARK_D + SPARK_MS);

    // Hold, then notify settle, then fade out
    const tieEnd = d + SLIDE_MS + TAIL_D + TAIL_MS + TAIL_R_LAG + 80;
    at(() => { if (onCycleSettle) onCycleSettle(); }, tieEnd + HOLD_MS);
    at(() => setFading(true), tieEnd + HOLD_MS);

    // After fade completes, reset and loop
    at(() => {
      setSlideIn(false);
      setKnotIn(false);
      setTailsIn(false);
      setSparksIn(false);
      setFading(false);
      setCycle(c => c + 1);
    }, tieEnd + HOLD_MS + FADE_MS + GAP_MS);

    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  const knotTop  = Math.round((BELT_H - KNOT_C_H) / 2);
  const beltPct  = 100 - PATCH_PCT - TIP_PCT;
  const tipStart = 100 - TIP_PCT;

  const leftTailBg =
    `repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.10) 2px, rgba(0,0,0,0.10) 3px), ` +
    `linear-gradient(to bottom, ${beltColor} ${beltPct}%, ${patchColor} ${beltPct}%, ${patchColor} ${tipStart}%, #0D0D0D ${tipStart}%)`;

  return (
    <>
      <style>{`
        @keyframes j2LdrKnotForm {
          0%   { transform: translateX(-50%) translateY(5px) scaleY(0.04); opacity: 0; }
          55%  { transform: translateX(-50%) translateY(0)   scaleY(1.05); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0)   scaleY(1);    opacity: 1; }
        }
        @keyframes j2LdrTailL {
          0%   { height: 0;                   transform: rotate(0deg); }
          50%  { height: ${TAIL_H * 1.09}px;  transform: rotate(-22deg); }
          76%  { height: ${TAIL_H * 0.97}px;  transform: rotate(6deg); }
          100% { height: ${TAIL_H}px;         transform: rotate(0deg); }
        }
        @keyframes j2LdrTailR {
          0%   { height: 0;                   transform: rotate(0deg); }
          50%  { height: ${TAIL_H * 1.09}px;  transform: rotate(22deg); }
          76%  { height: ${TAIL_H * 0.97}px;  transform: rotate(-6deg); }
          100% { height: ${TAIL_H}px;         transform: rotate(0deg); }
        }
        @keyframes j2LdrTieT {
          0%   { opacity:0; transform:translate(0,-50%); }
          15%  { opacity:1; }
          80%  { opacity:0.85; }
          100% { opacity:0; transform:translate(-10px,-280%); }
        }
        @keyframes j2LdrTieB {
          0%   { opacity:0; transform:translate(0,-50%); }
          20%  { opacity:1; }
          80%  { opacity:0.85; }
          100% { opacity:0; transform:translate(8px,-320%); }
        }
        @keyframes j2LdrGlow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(196,145,95,0.30)); }
          50%      { filter: drop-shadow(0 0 14px rgba(196,145,95,0.55)); }
        }
      `}</style>

      {/* Fade wrapper for loop transitions */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}>
        <div style={{
          position: 'relative',
          width: BELT_W,
          height: BELT_H + TAIL_H,
          animation: 'j2LdrGlow 2s ease-in-out infinite',
        }}>

          {/* ── Belt bar ── */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BELT_H, overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 3,
              background: ribbed(beltColor),
              transform: slideIn ? 'translateX(0)' : 'translateX(-100%)',
              transition: slideIn ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none',
            }} />
          </div>

          {/* ── Knot (two crossing strips) ── */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: knotTop,
            width: KNOT_C_W,
            height: KNOT_C_H,
            overflow: 'visible',
            zIndex: 3,
            transformOrigin: 'center center',
            transform: knotIn ? undefined : 'translateX(-50%) scaleY(0)',
            opacity:   knotIn ? undefined : 0,
            animation: knotIn ? `j2LdrKnotForm ${KNOT_MS}ms ease-out forwards` : 'none',
          }}>
            {/* Lower strip */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: STRIP_W, height: STRIP_H,
              marginTop: -(STRIP_H / 2), marginLeft: -(STRIP_W / 2),
              borderRadius: 3,
              background: ribbed(beltColor),
              transform: `rotate(${STRIP_ANG}deg)`,
              zIndex: 3,
            }} />
            {/* Upper strip */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: STRIP_W, height: STRIP_H,
              marginTop: -(STRIP_H / 2), marginLeft: -(STRIP_W / 2),
              borderRadius: 3,
              background: ribbed(beltColor),
              transform: `rotate(-${STRIP_ANG}deg)`,
              zIndex: 4,
              boxShadow: '2px 3px 6px rgba(0,0,0,0.40)',
            }} />
          </div>

          {/* ── Left tail (patch end) ── */}
          <div style={{
            position: 'absolute',
            left: `calc(50% - ${TAIL_W + 2}px)`,
            top: BELT_H,
            width: TAIL_W,
            background: leftTailBg,
            borderRadius: '0 0 3px 3px',
            transformOrigin: 'top center',
            overflow: 'hidden',
            zIndex: 2,
            height: 0,
            animation: tailsIn ? `j2LdrTailL ${TAIL_MS}ms ease-out forwards` : 'none',
          }}>
            {Array.from({ length: stripes }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: 0, right: 0,
                height: 3,
                backgroundColor: '#FFFFFF',
                bottom: `${TIP_PCT + (i + 1) * 14}%`,
              }} />
            ))}
          </div>

          {/* ── Right tail ── */}
          <div style={{
            position: 'absolute',
            left: `calc(50% + 2px)`,
            top: BELT_H,
            width: TAIL_W,
            background: ribbed(beltColor),
            borderRadius: '0 0 3px 3px',
            transformOrigin: 'top center',
            overflow: 'hidden',
            zIndex: 2,
            height: 0,
            animation: tailsIn ? `j2LdrTailR ${TAIL_MS}ms ease-out forwards ${TAIL_R_LAG}ms` : 'none',
          }} />

          {/* ── Sparks ── */}
          <span style={{
            position: 'absolute', right: 8, top: Math.round(BELT_H / 2),
            fontSize: 16, fontWeight: 900, color: '#F2E4A8',
            opacity: 0, lineHeight: 1,
            pointerEvents: 'none', userSelect: 'none', zIndex: 5,
            animation: sparksIn ? `j2LdrTieT ${SPARK_MS}ms ease forwards` : 'none',
          }}>~</span>

          <span style={{
            position: 'absolute', right: -4, top: Math.round(BELT_H / 2),
            fontSize: 16, fontWeight: 900, color: '#F2E4A8',
            opacity: 0, lineHeight: 1,
            pointerEvents: 'none', userSelect: 'none', zIndex: 5,
            animation: sparksIn ? `j2LdrTieB ${SPARK_MS}ms ease forwards` : 'none',
          }}>!</span>

        </div>
      </div>
    </>
  );
}
