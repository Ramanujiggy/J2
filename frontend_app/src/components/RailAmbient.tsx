// Ambient rail background — one composed piece, tuned from Refero flagship
// research (TIDE, Endel, Headspace, Stardust). Prior revision was invisible
// on dark theme: 0.9px strokes at 0.32 alpha sit below the dark-UI
// perceptibility floor, and there was no blur/halo — which is what flagship
// ambient motifs actually rely on to register peripherally.
//
// Key moves in this revision:
//   • BLUR HALO layer — a strokeWidth 6 pentagon behind the crisp stroke with
//     feGaussianBlur stdDeviation 3.5. Breathes opacity 0.35↔0.65 on a
//     continuous 5s loop. This is the primary visible "glow" — it's always
//     on, so peripheral vision always has something to see.
//   • Crisp pentagon stroke raised to 1.6px / 0.55 peak opacity (was 0.9px / 0.32).
//   • R dropped 260 → 230 so the pentagon sits inside the rail as a closed
//     emblem (parsable by the eye) rather than an edge-clipped texture.
//   • Master form/dissolve cycle compressed 42s → 14s so the formation event
//     lands within a typical attention fixation (~3–10s window).
//   • Particle count cut: 15 drifters → 6, 8 travellers → 3, alpha ceiling
//     lifted 0.28 → 0.40 and concentrated around the pentagon, not scattered
//     to noise across the whole rail.
//
// Still respects: pointer-events none, z-index: -1 (with `isolation: isolate`
// on the rail aside), reduced-motion static tableau.

import { useSyncExternalStore } from 'react';
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
// A regular pentagon's horizontal extent is R × cos(18°) ≈ R × 0.951. With a
// 280-wide rail (±140 from center) and the halo stroke adding ~6 units to
// the visual edge, R=125 lands the widest vertices at x≈21 / x≈259 with ~15
// units of margin — pentagon reads clearly as a 5-pointed shape, not a
// triangle-shaped fragment. Earlier R=230 had two vertices clipped off-rail.
const R = 125;

// Pentagon vertices (top vertex first, clockwise).
const VERTS: [number, number][] = Array.from({ length: 5 }).map((_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
});

// Pentagon perimeter for stroke-dasharray.
const PERIM = Math.round(
  VERTS.reduce((sum, v, i) => {
    const n = VERTS[(i + 1) % VERTS.length]!;
    return sum + Math.hypot(n[0] - v[0], n[1] - v[1]);
  }, 0),
);

// Resting positions for the five vertex motes — each rest sits in the same
// quadrant as its target vertex, well outside the pentagon, so formation
// reads as "crystallizing inward from all directions" with clear travel
// distance (~230–340 units each) and no crossed paths.
//   VERTS[0] top            (140, 375) — rests above pentagon, top-center
//   VERTS[1] upper-right    (259, 461) — rests above-right
//   VERTS[2] lower-right    (214, 601) — rests below-right
//   VERTS[3] lower-left     ( 66, 601) — rests below-left
//   VERTS[4] upper-left     ( 21, 461) — rests above-left
const VERT_RESTS: [number, number][] = [
  [140,  50],
  [258, 190],
  [258, 870],
  [ 22, 870],
  [ 22, 190],
];

// ── Deterministic scatter ──────────────────────────────────────────────────

function rng(seed: number): number {
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Content-aware exclusion — keep drifters out of the densest content bands.
const NAV_BAND: [number, number]  = [110, 340];
const PILL_BAND: [number, number] = [870, 1000];

type Scatter = { x: number; y: number; r: number };

/** Sample a small deterministic scatter concentrated around the pentagon
 *  (Refero rec: "fewer, brighter, concentrated around the hero" vs
 *  "many, dim, scattered to noise"). */
function buildScatter(count: number, seedBase: number, opts: {
  minDist: number;
  sizeMin: number;
  sizeMax: number;
}): Scatter[] {
  const { minDist, sizeMin, sizeMax } = opts;
  const out: Scatter[] = [];
  let s = seedBase;
  let guard = 0;
  while (out.length < count && guard < count * 60) {
    guard++;
    s++;
    const x = rng(s) * W;
    // Biased sample: 75% within the pentagon vertical extent (y 270–730),
    // 25% in the rail body so the whole rail still feels alive.
    let y: number;
    if (rng(s * 3 + 1) < 0.75) {
      y = 260 + rng(s * 5 + 2) * 480;
    } else {
      y = rng(s * 7 + 3) * H;
    }
    const r = sizeMin + rng(s * 11 + 5) * (sizeMax - sizeMin);

    // Reject motes in the nav band unless they're in the outer gutters.
    if (y >= NAV_BAND[0] && y <= NAV_BAND[1]) {
      if (x > 32 && x < W - 32) continue;
    }
    // Reject motes in the practitioner pill band entirely — that zone is
    // content-dense and a mote there looks like dirt on the screen.
    if (y >= PILL_BAND[0] && y <= PILL_BAND[1]) continue;

    // Min-distance against existing motes.
    let ok = true;
    for (const p of out) {
      if (Math.hypot(p.x - x, p.y - y) < minDist) { ok = false; break; }
    }
    if (!ok) continue;

    out.push({ x, y, r });
  }
  return out;
}

const DRIFTERS = buildScatter(6, 1000, {
  minDist: 70, sizeMin: 0.9, sizeMax: 1.6,
});
const TRAVELLER_ANCHORS = buildScatter(3, 5000, {
  minDist: 90, sizeMin: 0.9, sizeMax: 1.3,
});

// Each traveller drifts between its anchor and a bezier-offset partner.
const TRAVELLERS = TRAVELLER_ANCHORS.map((a, i) => {
  const bearing = rng(9000 + i) * Math.PI * 2;
  const dist = 50 + rng(9500 + i) * 40;
  const bx = Math.max(10, Math.min(W - 10, a.x + Math.cos(bearing) * dist));
  const by = Math.max(10, Math.min(H - 10, a.y + Math.sin(bearing) * dist));
  return {
    from: [a.x, a.y] as const,
    to:   [bx, by] as const,
    r:    a.r,
    dur:  14 + rng(9900 + i) * 6,
    delay: rng(9750 + i) * 3,
  };
});

// ── Master-cycle keyTimes (fractions of a 14s loop) ─────────────────────────
// 0–4s  form   (0.00 → 0.286)
// 4–7s  hold   (0.286 → 0.500)
// 7–11s dissolve (0.500 → 0.786)
// 11–14s rest  (0.786 → 1.000)

const MASTER = '14s';
const KT = {
  formEnd:    0.286,
  holdEnd:    0.500,
  dissolveEnd: 0.786,
} as const;

const EASE = '0.4 0 0.2 1';

// ── Component ───────────────────────────────────────────────────────────────

export default function RailAmbient() {
  const reduced = usePrefersReducedMotion();
  const pathD =
    VERTS.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';

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
          {/* Core halo filter — this is what makes the ambient prism read as
              intentional glow rather than a thin disappearing line. */}
          <filter id="rail-amb-halo-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          {/* Soft center wash — gives the pentagon a faint presence even
              during the rest phase when the crisp stroke is invisible. */}
          <radialGradient id="rail-amb-wash" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={PALE_YELLOW} stopOpacity="0.07" />
            <stop offset="70%" stopColor={PALE_YELLOW} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient center wash — always on. */}
        <circle cx={CX} cy={CY} r={R * 1.2} fill="url(#rail-amb-wash)" />

        {/* ── Prism group ───────────────────────────────────────── */}
        {/* Nested-group SMIL scale pattern: outer translate moves the origin
            to the pentagon center, middle group animates scale (which is
            origin-relative in SVG), inner translate undoes the offset so the
            paths stay in their original coord system. Net effect: scale
            centered at (CX, CY). 7s period — intentionally different from
            the 5s halo-opacity breath so the two rhythms don't lock. */}
        <g transform={`translate(${CX} ${CY})`}>
          <g>
            {!reduced && (
              <animateTransform
                attributeName="transform"
                type="scale"
                values="1;1.04;1"
                keyTimes="0;0.5;1"
                dur="7s"
                repeatCount="indefinite"
              />
            )}
            <g transform={`translate(${-CX} ${-CY})`}>
              {/* HALO layer — strokeWidth 6, blurred, copper-hued. Primary
                  visible glow. 5s opacity breath underneath the scale breath. */}
              <path
                d={pathD}
                fill="none"
                stroke={COPPER}
                strokeWidth={6}
                strokeLinejoin="round"
                filter="url(#rail-amb-halo-blur)"
                opacity={reduced ? 0.45 : 0.35}
              >
                {!reduced && (
                  <animate
                    attributeName="opacity"
                    values="0.35;0.65;0.35"
                    dur="5s"
                    repeatCount="indefinite"
                  />
                )}
              </path>

              {/* Ghost stroke — thin, always-on reference line. */}
              <path
                d={pathD}
                fill="none"
                stroke={PALE_YELLOW}
                strokeOpacity={0.10}
                strokeWidth={0.7}
                strokeLinejoin="round"
              />

              {/* Active crisp stroke — draws in during form, holds, fades on
                  dissolve via opacity (not stroke-reverse, reads as glitch). */}
              <path
                d={pathD}
                fill="none"
                stroke={PALE_YELLOW}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeDasharray={PERIM}
                strokeOpacity={reduced ? 0.55 : 0}
                strokeDashoffset={reduced ? 0 : PERIM}
              >
                {!reduced && (
                  <>
                    <animate
                      attributeName="stroke-dashoffset"
                      dur={MASTER}
                      keyTimes={`0;${KT.formEnd};${KT.holdEnd};${KT.dissolveEnd};1`}
                      values={`${PERIM};0;0;0;${PERIM}`}
                      calcMode="spline"
                      keySplines={`${EASE};0 0 1 1;0 0 1 1;0 0 1 1`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-opacity"
                      dur={MASTER}
                      keyTimes={`0;${KT.formEnd};${KT.holdEnd};${KT.dissolveEnd};1`}
                      values="0;0.55;0.55;0;0"
                      calcMode="spline"
                      keySplines={`${EASE};0 0 1 1;${EASE};0 0 1 1`}
                      repeatCount="indefinite"
                    />
                  </>
                )}
              </path>
            </g>
          </g>
        </g>

        {/* ── Orbital light satellites ──────────────────────────────
            Two dots travel the pentagon perimeter continuously via
            animateMotion along pathD. The primary (champagne) has a blurred
            comet head bonded to it; the secondary (copper) is phase-offset
            by half the loop so the two satellites are always 180° apart,
            chasing each other around the prism. This is the "circling"
            the user asked for — the pentagon itself now has continuous,
            clearly kinetic motion on-screen at all times (not gated by
            the 14s form cycle). */}
        {!reduced && (
          <>
            {/* Primary comet head — soft blurred glow, travels with the primary dot. */}
            <circle r={5.5} fill={PALE_YELLOW} opacity={0.22} filter="url(#rail-amb-halo-blur)">
              <animateMotion dur="16s" repeatCount="indefinite" path={pathD} />
            </circle>
            {/* Primary satellite — bright champagne pinpoint. */}
            <circle r={2.5} fill={PALE_YELLOW} opacity={0.85}>
              <animateMotion dur="16s" repeatCount="indefinite" rotate="auto" path={pathD} />
            </circle>
            {/* Secondary satellite — dimmer copper, 180° out of phase.
                begin="-8s" starts the animation 8s in the past, so at t=0
                it is already halfway along the 16s path. */}
            <circle r={2} fill={COPPER} opacity={0.55}>
              <animateMotion dur="16s" begin="-8s" repeatCount="indefinite" rotate="auto" path={pathD} />
            </circle>
          </>
        )}

        {/* ── Ambient drifters — 6 twinkling motes around the prism ─── */}
        {DRIFTERS.map((p, i) => {
          const base = 0.16 + rng(2000 + i) * 0.08;
          const peak = 0.32 + rng(2100 + i) * 0.08;
          const dur = 4 + rng(2200 + i) * 4;
          const delay = rng(2300 + i) * 3;
          return (
            <circle
              key={`dr-${i}`}
              cx={p.x} cy={p.y} r={p.r}
              fill={COPPER}
              opacity={reduced ? (base + peak) / 2 : base}
            >
              {!reduced && (
                <animate
                  attributeName="opacity"
                  values={`${base};${peak};${base}`}
                  dur={`${dur}s`}
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          );
        })}

        {/* ── Travellers — 3 drifting motes on short bezier paths ─── */}
        {!reduced && TRAVELLERS.map((t, i) => {
          const mx = (t.from[0] + t.to[0]) / 2 + (rng(3000 + i) - 0.5) * 24;
          const my = (t.from[1] + t.to[1]) / 2 + (rng(3100 + i) - 0.5) * 24;
          const d = `M ${t.from[0]} ${t.from[1]} Q ${mx} ${my} ${t.to[0]} ${t.to[1]}`;
          return (
            <circle key={`tr-${i}`} r={t.r} fill={COPPER} opacity={0.32}>
              <animateMotion
                dur={`${t.dur}s`}
                begin={`${t.delay}s`}
                repeatCount="indefinite"
                path={d}
                keyPoints="0;1;0"
                keyTimes="0;0.5;1"
                calcMode="spline"
                keySplines={`${EASE};${EASE}`}
              />
              <animate
                attributeName="opacity"
                values="0.18;0.40;0.18"
                dur={`${t.dur}s`}
                begin={`${t.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          );
        })}
        {reduced && TRAVELLERS.map((t, i) => (
          <circle key={`tr-static-${i}`} cx={t.from[0]} cy={t.from[1]} r={t.r} fill={COPPER} opacity={0.26} />
        ))}

        {/* ── Vertex motes — the 5 hero "form the prism" motes ─────── */}
        {VERTS.map((v, i) => {
          const rest = VERT_RESTS[i]!;
          // 14s cycle is tight; stagger 0.12s each so formation isn't
          // mechanical but still completes within the form phase.
          const stagger = i * 0.12;
          const kt = `0;${KT.formEnd};${KT.holdEnd};${KT.dissolveEnd};1`;

          if (reduced) {
            return (
              <circle
                key={`vm-${i}`}
                cx={v[0]} cy={v[1]} r={1.8}
                fill={PALE_YELLOW}
                opacity={0.7}
              />
            );
          }

          // x/y: rest → vertex → vertex → rest → rest
          const xs = `${rest[0]};${v[0]};${v[0]};${rest[0]};${rest[0]}`;
          const ys = `${rest[1]};${v[1]};${v[1]};${rest[1]};${rest[1]}`;
          // opacity: 0.4 drift → 0.95 vertex → 0.95 held → 0.4 drift → 0.4
          const os = '0.40;0.95;0.95;0.40;0.40';
          const splines = `${EASE};0 0 1 1;${EASE};0 0 1 1`;

          return (
            <circle
              key={`vm-${i}`}
              cx={rest[0]}
              cy={rest[1]}
              r={1.8}
              fill={PALE_YELLOW}
              opacity={0.4}
            >
              <animate
                attributeName="cx"
                dur={MASTER}
                begin={`${stagger}s`}
                keyTimes={kt}
                values={xs}
                calcMode="spline"
                keySplines={splines}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                dur={MASTER}
                begin={`${stagger}s`}
                keyTimes={kt}
                values={ys}
                calcMode="spline"
                keySplines={splines}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                dur={MASTER}
                begin={`${stagger}s`}
                keyTimes={kt}
                values={os}
                calcMode="spline"
                keySplines={splines}
                repeatCount="indefinite"
              />
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
