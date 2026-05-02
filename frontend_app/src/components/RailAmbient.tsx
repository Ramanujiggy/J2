// Ambient rail background — v3 polish pass.
//
// Refero anchors (Stardust, Endel, Moonly, Remy, mobile WaveBackground):
// the user's complaint was "it just seems like static floating right now."
// Diagnosis: the prior Prism's form-and-dissolve cycle was correct in
// spirit but the perimeter satellites read as a loading spinner, the rhythms
// (14s + 5s + 7s + 16s) were coprime so the eye registered chaos rather than
// breath, and there was no texture *behind* the focal motif.
//
// This revision makes 8 specific moves:
//
//   1. Master 12s breath clock. All motion uses multiples of 12s (12 / 24 / 36 / 72).
//      Coprime rhythms read as static; harmonic rhythms read as alive.
//   2. Focal Prism is now permanently visible and breathes in opacity
//      (50% → 85%) on the 12s clock. Form-and-dissolve is retired —
//      it was the source of the "static floating" feel because the rest
//      phase had no kinetic anchor.
//   3. 9 mini-pentagons in three phase-staggered groups of three, copper
//      hairline at 8% opacity, drifting in/out on 36s. Always ~6 visible.
//      Answers the user's "maybe a lot of small prisms" cue.
//   4. Starfield: 5 far / 6 mid / 3 near at differential drift speeds —
//      parallax depth without overt motion. Replaces the prior 6 drifters
//      and 3 bezier travelers (which were jittery).
//   5. Copper seigaiha layer behind everything at 4% alpha, drifting 36s
//      diagonally — same fish-scale tile as mobile's WaveBackground but
//      slower and quieter for the rail.
//   6. Crystallization moments — one of three pre-defined copper hairline
//      connections fades in and out over 72s, so every ~24s a line briefly
//      draws between two mini-pentagons.
//   7. Single champagne mote rides one edge of the focal pentagon every
//      12s — replaces the two perimeter satellites (which read as a
//      loading spinner).
//   8. Vertical 3% gradient anchors the rail so the seigaiha doesn't read
//      as flat tile.
//
// Still respects: pointer-events: none, z-index: -1 with `isolation: isolate`
// on the rail aside, full reduced-motion fallback.

import { useId, useSyncExternalStore } from 'react';
import { COPPER, PALE_YELLOW } from '../lib/theme.ts';

// ── Reduced-motion store (same pattern as useIsDesktop) ─────────────────────

const RM_MQ = '(prefers-reduced-motion: reduce)';
const rmSubscribe = (cb: () => void) => {
  const mql = window.matchMedia(RM_MQ);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};
const rmSnapshot = () => window.matchMedia(RM_MQ).matches;
const rmServerSnapshot = () => false;
function usePrefersReducedMotion() {
  return useSyncExternalStore(rmSubscribe, rmSnapshot, rmServerSnapshot);
}

// ── Geometry ────────────────────────────────────────────────────────────────

const W = 280;
const H = 1000;
const CX = 140;
const CY = 500;
const R  = 125;

// Focal pentagon vertices (top vertex first, clockwise).
const VERTS: [number, number][] = Array.from({ length: 5 }).map((_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
});

const PENTAGON_PATH =
  VERTS.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';

// Top edge of the focal pentagon — used by the single champagne mote that
// rides "one edge" per 12s breath (move #7).
const TOP_EDGE = `M ${VERTS[0][0]} ${VERTS[0][1]} L ${VERTS[1][0]} ${VERTS[1][1]}`;

// Mini pentagon path generator — returns a path centered at (cx, cy).
function miniPentagon(cx: number, cy: number, r: number): string {
  return Array.from({ length: 5 }).map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ') + ' Z';
}

// Hand-placed scatter of 9 mini-pentagons — Poisson-disk-feel without an RNG.
// Distributed across the rail's available negative space:
//   - 2 in the top gutter (above the wordmark)
//   - 4 flanking the focal pentagon (left/right gutters)
//   - 3 below the focus card (above the practitioner pill)
// Group index assigns the phase-staggered fade-in band (move #3).
const MINIS: { x: number; y: number; r: number; group: 0 | 1 | 2 }[] = [
  { x:  56, y:  68, r:  9, group: 0 },
  { x: 222, y:  88, r: 12, group: 1 },
  { x:  18, y: 380, r:  9, group: 2 },
  { x: 262, y: 360, r:  8, group: 0 },
  { x:  18, y: 620, r: 10, group: 1 },
  { x: 262, y: 640, r:  8, group: 2 },
  { x:  68, y: 740, r: 13, group: 0 },
  { x: 210, y: 760, r: 10, group: 1 },
  { x: 142, y: 815, r:  8, group: 2 },
];

// Three pre-defined connection pairs for the crystallization moment (move #6).
// Each pair's two endpoints sit on visible mini-pentagons, picked so the line
// crosses the rail without intersecting the focal Prism's body.
const CRYST_PAIRS: [number, number][] = [
  [0, 6], // top-left → bottom-left band
  [1, 5], // top-right → mid-right
  [2, 8], // mid-left → bottom-center
];

// Starfield — three depths, hand-distributed. Far is dimmest + smallest,
// near is brightest + largest. All deterministic so SSR matches client.
const FAR_STARS: { x: number; y: number }[] = [
  { x:  92, y: 195 }, { x: 188, y: 275 }, { x:  42, y: 545 },
  { x: 248, y: 685 }, { x: 110, y: 905 },
];
const MID_STARS: { x: number; y: number; dx: number; dy: number }[] = [
  { x:  34, y: 125, dx:  4, dy:  3 },
  { x: 240, y: 195, dx: -3, dy:  4 },
  { x:  50, y: 425, dx:  3, dy: -2 },
  { x: 232, y: 460, dx: -2, dy:  3 },
  { x:  76, y: 685, dx:  4, dy:  3 },
  { x: 196, y: 880, dx: -3, dy: -3 },
];
const NEAR_STARS: { x: number; y: number; dx: number; dy: number }[] = [
  { x: 118, y: 360, dx:  6, dy:  4 },
  { x: 156, y: 660, dx: -5, dy:  6 },
  { x:  68, y: 840, dx:  6, dy: -4 },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function RailAmbient() {
  const reduced = usePrefersReducedMotion();
  const uid = useId();
  const seigaihaId = `rail-seigaiha-${uid}`;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: -1,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Halo blur — used by the focal-prism halo and the champagne edge mote. */}
          <filter id="rail-halo-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>

          {/* Move #8 — vertical 3% gradient anchors the rail so the seigaiha
              doesn't read as flat tile. Forest-green at top → very slightly
              warmer copper-tinted at bottom. */}
          <linearGradient id="rail-vgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0D1A14" stopOpacity="0" />
            <stop offset="100%" stopColor={COPPER}  stopOpacity="0.025" />
          </linearGradient>

          {/* Center wash behind the focal Prism — gives it ground even at
              opacity trough. */}
          <radialGradient id="rail-center-wash" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={PALE_YELLOW} stopOpacity="0.06" />
            <stop offset="70%" stopColor={PALE_YELLOW} stopOpacity="0" />
          </radialGradient>

          {/* Move #5 — copper seigaiha tile at very low alpha. 48×48 (mobile
              uses 36×36 — bigger here so the rail's narrower width still
              shows ~6 columns rather than crowding). */}
          <pattern id={seigaihaId} width="48" height="48" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={COPPER} strokeLinecap="round">
              {[
                { cx:  0, cy: 24 },
                { cx: 48, cy: 24 },
                { cx: 24, cy: 48 },
              ].map(({ cx, cy }) =>
                [22, 15, 8].map((r, i) => (
                  <path
                    key={`${cx}-${cy}-${r}`}
                    d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`}
                    strokeWidth={i === 0 ? 1.4 : i === 1 ? 1.0 : 0.7}
                    strokeOpacity={0.85}
                  />
                )),
              )}
            </g>
          </pattern>
        </defs>

        {/* Vertical anchor gradient (move #8) */}
        <rect x={0} y={0} width={W} height={H} fill="url(#rail-vgrad)" />

        {/* Seigaiha texture (move #5) — drifting diagonally on 36s, behind
            everything else. 4% alpha — pattern is at 0.85 stroke opacity
            internally but the parent group's opacity multiplies down. */}
        <g opacity={0.04}>
          <g>
            {!reduced && (
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="48 -48"
                dur="36s"
                repeatCount="indefinite"
              />
            )}
            <rect x={-48} y={-48} width={W + 96} height={H + 96} fill={`url(#${seigaihaId})`} />
          </g>
        </g>

        {/* Center wash behind the Prism */}
        <circle cx={CX} cy={CY} r={R * 1.2} fill="url(#rail-center-wash)" />

        {/* ── Starfield (move #4) ───────────────────────────────────────
            Three depths at differential drift speeds. Far stars don't move;
            mid stars drift slowly; near stars drift faster. The eye reads
            this as parallax depth without overt motion. */}

        {/* Far stars — 1px, 15% opacity, no motion */}
        {FAR_STARS.map((s, i) => (
          <circle key={`far-${i}`} cx={s.x} cy={s.y} r={1} fill={PALE_YELLOW} opacity={0.15} />
        ))}

        {/* Mid stars — 1.5px, 30% opacity, slow drift via animateTransform */}
        {MID_STARS.map((s, i) => (
          <g key={`mid-${i}`}>
            {!reduced && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 0; ${s.dx} ${s.dy}; 0 0`}
                keyTimes="0;0.5;1"
                dur="36s"
                repeatCount="indefinite"
              />
            )}
            <circle cx={s.x} cy={s.y} r={1.5} fill={PALE_YELLOW} opacity={0.30} />
          </g>
        ))}

        {/* Near stars — 2px, 50% opacity, faster drift */}
        {NEAR_STARS.map((s, i) => (
          <g key={`near-${i}`}>
            {!reduced && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 0; ${s.dx} ${s.dy}; 0 0`}
                keyTimes="0;0.5;1"
                dur="24s"
                repeatCount="indefinite"
              />
            )}
            <circle cx={s.x} cy={s.y} r={2} fill={PALE_YELLOW} opacity={0.50} />
          </g>
        ))}

        {/* ── Mini-pentagons (move #3) ──────────────────────────────────
            9 small prisms grouped by phase. Each group fades in/out over
            a 36s cycle, staggered by 12s, so 6 of 9 are visible at any
            moment — answers the user's "lots of small prisms" cue. */}
        {MINIS.map((m, i) => {
          const begin = m.group * 12;
          return (
            <path
              key={`mini-${i}`}
              d={miniPentagon(m.x, m.y, m.r)}
              fill="none"
              stroke={COPPER}
              strokeWidth={0.9}
              strokeLinejoin="round"
              opacity={reduced ? 0.06 : 0}
            >
              {!reduced && (
                <animate
                  attributeName="opacity"
                  values="0;0.10;0.10;0;0"
                  keyTimes="0;0.111;0.667;0.778;1"
                  dur="36s"
                  begin={`${begin}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1;0 0 1 1"
                />
              )}
            </path>
          );
        })}

        {/* ── Crystallization lines (move #6) ───────────────────────────
            Three pre-defined hairline connections between mini-pentagons,
            phase-staggered on a 72s cycle. Each line: draw 1.8s, hold 4s,
            fade 2.2s. Eight seconds of visibility per 72s, but staggered
            so a line is visible roughly every 24s. */}
        {!reduced && CRYST_PAIRS.map(([aIdx, bIdx], i) => {
          const a = MINIS[aIdx]!;
          const b = MINIS[bIdx]!;
          const lineLen = Math.hypot(b.x - a.x, b.y - a.y);
          const begin = i * 24;
          return (
            <line
              key={`cryst-${i}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={COPPER}
              strokeWidth={0.6}
              strokeOpacity={0}
              strokeDasharray={lineLen}
              strokeDashoffset={lineLen}
            >
              {/* Draw the line in over 1.8s, hold, fade out, then rest. */}
              <animate
                attributeName="stroke-dashoffset"
                values={`${lineLen};0;0;0;${lineLen};${lineLen}`}
                keyTimes="0;0.025;0.08;0.111;0.139;1"
                dur="72s"
                begin={`${begin}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-opacity"
                values="0;0.18;0.18;0;0"
                keyTimes="0;0.025;0.111;0.139;1"
                dur="72s"
                begin={`${begin}s`}
                repeatCount="indefinite"
              />
            </line>
          );
        })}

        {/* ── Focal Prism (move #2) ─────────────────────────────────────
            Permanent. Halo + ghost + crisp stroke, all breathing on the
            12s master clock. No more form-and-dissolve cycle. */}

        {/* Halo — strokeWidth 6, blurred. Breathes opacity 0.32 → 0.55. */}
        <path
          d={PENTAGON_PATH}
          fill="none"
          stroke={COPPER}
          strokeWidth={6}
          strokeLinejoin="round"
          filter="url(#rail-halo-blur)"
          opacity={reduced ? 0.42 : 0.32}
        >
          {!reduced && (
            <animate
              attributeName="opacity"
              values="0.32;0.55;0.32"
              keyTimes="0;0.5;1"
              dur="12s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
          )}
        </path>

        {/* Ghost stroke — always-on faint reference. */}
        <path
          d={PENTAGON_PATH}
          fill="none"
          stroke={PALE_YELLOW}
          strokeOpacity={0.10}
          strokeWidth={0.7}
          strokeLinejoin="round"
        />

        {/* Crisp stroke — breathes 0.50 → 0.85 opacity on 12s. */}
        <path
          d={PENTAGON_PATH}
          fill="none"
          stroke={PALE_YELLOW}
          strokeWidth={1}
          strokeLinejoin="round"
          opacity={reduced ? 0.65 : 0.50}
        >
          {!reduced && (
            <animate
              attributeName="opacity"
              values="0.50;0.85;0.50"
              keyTimes="0;0.5;1"
              dur="12s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
          )}
        </path>

        {/* Vertex pinpoints — brighten to champagne at apex of breath. */}
        {VERTS.map((v, i) => (
          <circle
            key={`vertex-${i}`}
            cx={v[0]} cy={v[1]} r={1.6}
            fill={PALE_YELLOW}
            opacity={reduced ? 0.85 : 0.60}
          >
            {!reduced && (
              <animate
                attributeName="opacity"
                values="0.60;0.95;0.60"
                keyTimes="0;0.5;1"
                dur="12s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
              />
            )}
          </circle>
        ))}

        {/* ── Edge mote (move #7) ───────────────────────────────────────
            Single champagne mote that rides the top edge of the focal
            pentagon, one trip per 12s breath. Replaces the two perimeter
            satellites which read as a loading spinner. */}
        {!reduced && (
          <>
            <circle r={4} fill={PALE_YELLOW} opacity={0.30} filter="url(#rail-halo-blur)">
              <animateMotion dur="12s" repeatCount="indefinite" path={TOP_EDGE} />
            </circle>
            <circle r={2} fill={PALE_YELLOW} opacity={0.85}>
              <animateMotion dur="12s" repeatCount="indefinite" path={TOP_EDGE} />
            </circle>
          </>
        )}
      </svg>
    </div>
  );
}
