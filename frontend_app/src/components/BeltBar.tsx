// BeltBar — renders a BJJ belt bar that ties itself on mount.
// Belt slides in from the left; a two-strip crossing knot forms at the centre;
// tails drop straight down with a pendulum swing.
//
// Easter egg — once the tying animation completes the tails become interactive:
//   • Hover + drag cursor: tail follows horizontally (fast track, springy release)
//   • Click: whip-and-snap animation

import { useState, useEffect } from 'react';
import { type BeltRank, BELT_COLORS, PATCH_COLORS, ribbed } from '../lib/belt.ts';

// Re-export so existing consumers (AppShell, ProfilePage, ProfileContext) don't break.
export { type BeltRank, BELT_COLORS, PATCH_COLORS };

interface BeltBarProps {
  rank?: string | null;
  stripes?: number;
}

export default function BeltBar({ rank, stripes = 0 }: BeltBarProps) {
  const beltRank = rank as BeltRank | null;
  const beltColor = beltRank ? (BELT_COLORS[beltRank] ?? null) : null;
  const patchColor = beltRank ? (PATCH_COLORS[beltRank] ?? '#0D0D0D') : '#0D0D0D';
  if (!beltColor) return null;
  const clampedStripes = Math.min(Math.max(Math.round(stripes), 0), 4);
  return <BeltBarInner beltColor={beltColor} patchColor={patchColor} stripes={clampedStripes} />;
}

// ── Timing (ms) ──────────────────────────────────────────────────────────────
const SLIDE_MS   = 500;
const KNOT_D     =  65;
const KNOT_MS    = 300;
const TAIL_D     = 120;
const TAIL_MS    = 480;
const TAIL_R_LAG =  52;  // right tail starts this many ms after left
const SPARK_D    = 270;
const SPARK_MS   = 380;
const WHIP_MS    = 560;  // click whip duration

// ── Dimensions (px) ──────────────────────────────────────────────────────────
const BELT_H    = 14;
const STRIP_W   = 26;
const STRIP_H   = BELT_H;
const STRIP_ANG = 22;
const KNOT_C_W  = 32;
const KNOT_C_H  = 26;
const TAIL_W    = 10;
const TAIL_H    = 28;
const PATCH_PCT = 62;  // patch zone height as % of tail
const TIP_PCT   =  9;  // dark tip at the very bottom (always near-black)

function BeltBarInner({
  beltColor,
  patchColor,
  stripes,
}: {
  beltColor: string;
  patchColor: string;
  stripes: number;
}) {
  // ── Tying animation state ─────────────────────────────────────────────────
  const [slideIn,   setSlideIn]   = useState(false);
  const [knotIn,    setKnotIn]    = useState(false);
  const [tailsIn,   setTailsIn]   = useState(false);
  const [sparksIn,  setSparksIn]  = useState(false);
  // Switches tails from CSS-animation mode → interactive mode
  const [tailsDone, setTailsDone] = useState(false);

  // ── Interactive tail state (active only after tailsDone) ──────────────────
  const [leftRot,  setLeftRot]  = useState(0);
  const [rightRot, setRightRot] = useState(0);
  const [leftHov,  setLeftHov]  = useState(false);
  const [rightHov, setRightHov] = useState(false);
  const [whipL,    setWhipL]    = useState(false);
  const [whipR,    setWhipR]    = useState(false);

  useEffect(() => {
    const d = 40;
    // tailsDone fires after both tails finish dropping
    const tailsDoneAt = d + SLIDE_MS + TAIL_D + TAIL_MS + TAIL_R_LAG + 80;
    const t0 = setTimeout(() => setSlideIn(true),    d);
    const t1 = setTimeout(() => setKnotIn(true),     d + SLIDE_MS + KNOT_D);
    const t2 = setTimeout(() => setTailsIn(true),    d + SLIDE_MS + TAIL_D);
    const t3 = setTimeout(() => setSparksIn(true),   d + SLIDE_MS + SPARK_D);
    const t4 = setTimeout(() => setSparksIn(false),  d + SLIDE_MS + SPARK_D + SPARK_MS);
    const t5 = setTimeout(() => setTailsDone(true),  tailsDoneAt);
    return () => [t0, t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []);

  // ribbed() imported from '../lib/belt.ts'

  const knotTop  = Math.round((BELT_H - KNOT_C_H) / 2);  // centres knot on belt midline
  // Tail zones (% of tail height, top → bottom):
  //   belt colour  : 0 % → beltPct %
  //   patch colour : beltPct % → tipStart %
  //   dark tip     : tipStart % → 100 %  (always near-black, most visible on red/black belt)
  const beltPct  = 100 - PATCH_PCT - TIP_PCT;  // = 29 %
  const tipStart = 100 - TIP_PCT;               // = 91 %

  // Left tail background: ribbing texture over a 3-zone colour gradient
  const leftTailBg =
    `repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.10) 2px, rgba(0,0,0,0.10) 3px), ` +
    `linear-gradient(to bottom, ${beltColor} ${beltPct}%, ${patchColor} ${beltPct}%, ${patchColor} ${tipStart}%, #0D0D0D ${tipStart}%)`;

  // ── Tail interaction helpers ──────────────────────────────────────────────

  const onTailMove = (e: React.MouseEvent, setter: (r: number) => void) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx   = e.clientX - (rect.left + rect.width / 2);
    setter(Math.max(-34, Math.min(34, dx * 0.78)));
  };

  const startWhip = (
    whipping: boolean,
    setWhip: (v: boolean) => void,
    setRot:  (v: number) => void,
  ) => {
    if (whipping || !tailsDone) return;
    setRot(0);
    setWhip(true);
    setTimeout(() => setWhip(false), WHIP_MS + 30);
  };

  // Returns the style fragment that drives interactive behaviour.
  // Merged into the tail's style object via spread.
  // height and transformOrigin live in the element's static styles.
  const interactStyle = (
    rot:      number,
    hov:      boolean,
    whipping: boolean,
    anim:     string,
  ): React.CSSProperties => ({
    animation:  whipping ? `${anim} ${WHIP_MS}ms ease-out forwards` : 'none',
    transform:  whipping ? undefined : `rotate(${rot}deg)`,
    transition: whipping ? undefined : `transform ${hov ? '0.07s linear' : '0.42s cubic-bezier(0.34,1.4,0.64,1)'}`,
    cursor:     whipping ? 'default' : 'grab',
  });

  // Style for a tail while the drop animation is still playing.
  // height and transformOrigin live in the element's static styles.
  // Before tailsIn: scaleY(0) hides the tail without touching layout.
  // Once tailsIn fires the keyframe takes over from its own 0% scaleY(0).
  const dropStyle = (anim: string, delay = 0): React.CSSProperties => ({
    transform: tailsIn ? undefined : 'scaleY(0)',
    animation: tailsIn ? `${anim} ${TAIL_MS}ms ease-out forwards ${delay}ms` : 'none',
  });

  return (
    <>
      <style>{`
        @keyframes j2KnotForm {
          0%   { transform: translateX(-50%) translateY(5px) scaleY(0.04); opacity: 0; }
          55%  { transform: translateX(-50%) translateY(0)   scaleY(1.05); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0)   scaleY(1);    opacity: 1; }
        }

        /*
          Drop: pendulum overshoot (outward), swing past vertical, settle straight down.
          Final angle is 0° — tails hang plumb.
          scaleY instead of height: compositor-only, no layout recalc per frame.
          transformOrigin: top center (set on the element) so scale grows downward.
        */
        @keyframes j2TailL {
          0%   { transform: scaleY(0)    rotate(0deg);   }
          50%  { transform: scaleY(1.09) rotate(-22deg); }
          76%  { transform: scaleY(0.97) rotate(6deg);   }
          100% { transform: scaleY(1)    rotate(0deg);   }
        }
        @keyframes j2TailR {
          0%   { transform: scaleY(0)    rotate(0deg);   }
          50%  { transform: scaleY(1.09) rotate(22deg);  }
          76%  { transform: scaleY(0.97) rotate(-6deg);  }
          100% { transform: scaleY(1)    rotate(0deg);   }
        }

        /*
          Whip: sharp outward swing → overshoot back → damped oscillation → rest.
          Triggered on click as an easter egg.
        */
        @keyframes j2WhipL {
          0%   { transform: rotate(0deg); }
          17%  { transform: rotate(-54deg); }
          40%  { transform: rotate(20deg); }
          62%  { transform: rotate(-11deg); }
          82%  { transform: rotate(4deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes j2WhipR {
          0%   { transform: rotate(0deg); }
          17%  { transform: rotate(54deg); }
          40%  { transform: rotate(-20deg); }
          62%  { transform: rotate(11deg); }
          82%  { transform: rotate(-4deg); }
          100% { transform: rotate(0deg); }
        }

        @keyframes j2TieT {
          0%   { opacity:0; transform:translate(0,-50%); }
          15%  { opacity:1; }
          80%  { opacity:0.85; }
          100% { opacity:0; transform:translate(-7px,-280%); }
        }
        @keyframes j2TieB {
          0%   { opacity:0; transform:translate(0,-50%); }
          20%  { opacity:1; }
          80%  { opacity:0.85; }
          100% { opacity:0; transform:translate(5px,-320%); }
        }
      `}</style>

      <div style={{ position: 'relative', height: BELT_H + TAIL_H, marginTop: 3, overflow: 'visible', filter: 'drop-shadow(0 0 3px rgba(196,145,95,0.35))' }}>

        {/* ── Belt bar ── */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BELT_H, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 2,
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
          animation: knotIn ? `j2KnotForm ${KNOT_MS}ms ease-out forwards` : 'none',
        }}>
          {/* Lower strip */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: STRIP_W, height: STRIP_H,
            marginTop: -(STRIP_H / 2), marginLeft: -(STRIP_W / 2),
            borderRadius: 2,
            background: ribbed(beltColor),
            transform: `rotate(${STRIP_ANG}deg)`,
            zIndex: 3,
          }} />
          {/* Upper strip — shadow shows it sitting on top of the lower */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: STRIP_W, height: STRIP_H,
            marginTop: -(STRIP_H / 2), marginLeft: -(STRIP_W / 2),
            borderRadius: 2,
            background: ribbed(beltColor),
            transform: `rotate(-${STRIP_ANG}deg)`,
            zIndex: 4,
            boxShadow: '1px 2px 4px rgba(0,0,0,0.40)',
          }} />
        </div>

        {/* ── Left tail (patch end) ── */}
        <div
          style={{
            position:        'absolute',
            left:            `calc(50% - ${TAIL_W + 1}px)`,
            top:             BELT_H,
            width:           TAIL_W,
            height:          TAIL_H,          // static — animation uses scaleY, not height
            transformOrigin: 'top center',    // static — scaleY grows downward from knot base
            background:      leftTailBg,
            borderRadius:    '0 0 2px 2px',
            overflow:        'hidden',
            zIndex:          2,
            ...(tailsDone
              ? interactStyle(leftRot, leftHov, whipL, 'j2WhipL')
              : dropStyle('j2TailL')),
          }}
          onMouseMove={tailsDone && !whipL ? (e) => onTailMove(e, setLeftRot) : undefined}
          onMouseEnter={tailsDone ? () => setLeftHov(true) : undefined}
          onMouseLeave={tailsDone ? () => { setLeftHov(false); setLeftRot(0); } : undefined}
          onClick={tailsDone ? () => startWhip(whipL, setWhipL, setLeftRot) : undefined}
        >
          {Array.from({ length: stripes }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: 0, right: 0,
              height: 2,
              backgroundColor: '#FFFFFF',
              // Fixed spacing from bottom of patch zone upward — each stripe added above the last
              bottom: `${TIP_PCT + (i + 1) * 14}%`,
            }} />
          ))}
        </div>

        {/* ── Right tail ── */}
        <div
          style={{
            position:        'absolute',
            left:            `calc(50% + 1px)`,
            top:             BELT_H,
            width:           TAIL_W,
            height:          TAIL_H,          // static — animation uses scaleY, not height
            transformOrigin: 'top center',    // static — scaleY grows downward from knot base
            background:      ribbed(beltColor),
            borderRadius:    '0 0 2px 2px',
            overflow:        'hidden',
            zIndex:          2,
            ...(tailsDone
              ? interactStyle(rightRot, rightHov, whipR, 'j2WhipR')
              : dropStyle('j2TailR', TAIL_R_LAG)),
          }}
          onMouseMove={tailsDone && !whipR ? (e) => onTailMove(e, setRightRot) : undefined}
          onMouseEnter={tailsDone ? () => setRightHov(true) : undefined}
          onMouseLeave={tailsDone ? () => { setRightHov(false); setRightRot(0); } : undefined}
          onClick={tailsDone ? () => startWhip(whipR, setWhipR, setRightRot) : undefined}
        />

        {/* ── Sparks ── */}
        <span style={{
          position: 'absolute', right: 4, top: Math.round(BELT_H / 2),
          fontSize: 10, fontWeight: 900, color: '#F2E4A8',
          opacity: 0, lineHeight: 1,
          pointerEvents: 'none', userSelect: 'none', zIndex: 5,
          animation: sparksIn ? `j2TieT ${SPARK_MS}ms ease forwards` : 'none',
        }}>~</span>

        <span style={{
          position: 'absolute', right: -2, top: Math.round(BELT_H / 2),
          fontSize: 10, fontWeight: 900, color: '#F2E4A8',
          opacity: 0, lineHeight: 1,
          pointerEvents: 'none', userSelect: 'none', zIndex: 5,
          animation: sparksIn ? `j2TieB ${SPARK_MS}ms ease forwards` : 'none',
        }}>!</span>

      </div>
    </>
  );
}
