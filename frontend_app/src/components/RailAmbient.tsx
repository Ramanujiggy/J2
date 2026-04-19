// Ambient rail background — one composed piece, not two.
// A huge "Grappling Prism" pentagon breathes in and out behind the rail while
// motes scattered across the full rail height periodically gather to form it,
// hold, then disperse. Slow 42s master cycle; meant to register peripherally,
// never compete with content.
//
// Design rules:
//   • One SVG that fills the rail (viewBox 280×1000, xMidYMid slice).
//   • Pentagon is a background element — R=260, bleeds near the rail edges.
//   • 28 motes total in three classes: 5 vertex motes, 15 ambient drifters,
//     8 travellers (independent short-path drift).
//   • Content-aware scatter — low density behind wordmark/nav/pill, dense in
//     the "dead zone" between focus card and practitioner pill.
//   • Pure SMIL + CSS (no deps, no RAF); reduced-motion renders a static tableau.
//   • pointer-events: none; z-index: -1 (paired with `isolation: isolate` on
//     the rail <aside>) so it sits below wordmark, nav, focus card, belt bar.

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
const R = 260;

// Pentagon vertices (top vertex first, clockwise).
const VERTS: [number, number][] = Array.from({ length: 5 }).map((_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
});

// Approximate pentagon perimeter for stroke-dasharray.
const PERIM = Math.round(
  VERTS.reduce((sum, v, i) => {
    const n = VERTS[(i + 1) % VERTS.length]!;
    return sum + Math.hypot(n[0] - v[0], n[1] - v[1]);
  }, 0),
);

// Resting positions for the five vertex motes — hand-placed rather than
// random, so the formation visibly "gathers" from expected corners of the
// rail instead of seeming to teleport. Two rest in the upper half (above the
// focus card), two rest in the lower-middle, one pokes out top-right.
const VERT_RESTS: [number, number][] = [
  [ 42,  80],   // upper-left — near wordmark line
  [240, 160],   // upper-right — near nav top
  [ 30, 560],   // mid-left — below focus card
  [250, 680],   // mid-right — below focus card
  [110, 920],   // bottom — above practitioner pill
];

// ── Deterministic scatter for drifters + travellers ────────────────────────
// Tiny seeded PRNG (same function used by the onboarding heroes).
function rng(seed: number): number {
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Content-aware exclusion zones (viewBox y ranges). Scatter avoids the
// densest content bands; positions are rejected and resampled if they land
// inside one of these AND the proposed mote is above a "small radius" cap.
const EXCLUDE_BANDS: Array<[number, number]> = [
  [110, 340],   // nav — strict
  [870, 1000],  // practitioner pill — near strict
];
const WORDMARK_BAND: [number, number] = [0, 90];

type Scatter = { x: number; y: number; r: number };

/** Sample a deterministic scatter with min-distance + band-aware density. */
function buildScatter(count: number, seedBase: number, opts: {
  minDist: number;
  sizeMin: number;
  sizeMax: number;
  denseBand?: [number, number]; // oversample this y range
}): Scatter[] {
  const { minDist, sizeMin, sizeMax, denseBand } = opts;
  const out: Scatter[] = [];
  let s = seedBase;
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard++;
    s++;
    let x = rng(s) * W;
    // Bias 60% of samples into the dense band (the open area below the
    // focus card) so the rail's "dead zone" actually reads as alive.
    let y: number;
    if (denseBand && rng(s * 3 + 1) < 0.6) {
      y = denseBand[0] + rng(s * 5 + 2) * (denseBand[1] - denseBand[0]);
    } else {
      y = rng(s * 7 + 3) * H;
    }
    const r = sizeMin + rng(s * 11 + 5) * (sizeMax - sizeMin);

    // Wordmark zone: only very small motes allowed, max 3.
    if (y >= WORDMARK_BAND[0] && y <= WORDMARK_BAND[1]) {
      if (r > 0.6) continue;
      const countInBand = out.filter(p => p.y >= WORDMARK_BAND[0] && p.y <= WORDMARK_BAND[1]).length;
      if (countInBand >= 3) continue;
    }

    // Nav band: reject unless in the outer 30px gutters.
    if (y >= EXCLUDE_BANDS[0]![0] && y <= EXCLUDE_BANDS[0]![1]) {
      if (x > 30 && x < W - 30) continue;
    }

    // Practitioner pill band: only tiny motes, max 2.
    if (y >= EXCLUDE_BANDS[1]![0] && y <= EXCLUDE_BANDS[1]![1]) {
      if (r > 0.5) continue;
      const countInBand = out.filter(p => p.y >= EXCLUDE_BANDS[1]![0]).length;
      if (countInBand >= 2) continue;
    }

    // Min-distance check against existing motes.
    let ok = true;
    for (const p of out) {
      if (Math.hypot(p.x - x, p.y - y) < minDist) { ok = false; break; }
    }
    if (!ok) continue;

    // Nudge x slightly away from dead-center (where the pentagon strokes
    // live) so scatter doesn't clump on the vertical axis.
    if (Math.abs(x - CX) < 14) x = x < CX ? x - 18 : x + 18;

    out.push({ x, y, r });
  }
  return out;
}

const DRIFTERS = buildScatter(15, 1000, {
  minDist: 36, sizeMin: 0.5, sizeMax: 1.0,
  denseBand: [520, 840],
});
const TRAVELLER_ANCHORS = buildScatter(8, 5000, {
  minDist: 48, sizeMin: 0.6, sizeMax: 0.9,
  denseBand: [520, 840],
});

// Each traveller gets a partner anchor offset ~60px on a semi-random bearing.
// That's the other end of its animateMotion path.
const TRAVELLERS = TRAVELLER_ANCHORS.map((a, i) => {
  const bearing = rng(9000 + i) * Math.PI * 2;
  const dist = 40 + rng(9500 + i) * 40;
  const bx = Math.max(8, Math.min(W - 8, a.x + Math.cos(bearing) * dist));
  const by = Math.max(8, Math.min(H - 8, a.y + Math.sin(bearing) * dist));
  return {
    from: [a.x, a.y] as const,
    to:   [bx, by] as const,
    r:    a.r,
    dur:  18 + rng(9900 + i) * 6,
    delay: rng(9750 + i) * 4,
  };
});

// ── Master-cycle keyTimes (all in fractions of a 42s loop) ──────────────────

const MASTER = '42s';
const KT = {
  driftStart:  0.00,
  gatherStart: 0.18,
  gatherEnd:   0.40,
  holdEnd:     0.58,
  disformEnd:  0.78,
  cycleEnd:    1.00,
} as const;

// Ease spline for gather / disform (matches chatted-about cubic).
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
        // z-index: -1 + `isolation: isolate` on the rail <aside> keeps this
        // underneath the wordmark / nav / focus card / belt / pill cleanly.
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
          {/* Very soft center halo — gives the pentagon a faint presence even
              during the drift phase when its strokes are invisible. */}
          <radialGradient id="rail-amb-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={PALE_YELLOW} stopOpacity="0.05" />
            <stop offset="70%" stopColor={PALE_YELLOW} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient halo always present — survives reduced-motion. */}
        <circle cx={CX} cy={CY} r={R * 1.1} fill="url(#rail-amb-halo)" />

        {/* ── Prism group — breathing + draw cycle ────────────────── */}
        <g
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transformBox: 'fill-box',
            opacity: reduced ? 1 : undefined,
          }}
        >
          {/* Ghost stroke — always visible so stills read. */}
          <path
            d={pathD}
            fill="none"
            stroke={PALE_YELLOW}
            strokeOpacity={0.06}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />

          {/* Active stroke — draws in during gather, holds, fades out opacity
              during disform (not stroke-reverse, which looks like a glitch). */}
          <path
            d={pathD}
            fill="none"
            stroke={PALE_YELLOW}
            strokeWidth={0.9}
            strokeLinejoin="round"
            strokeDasharray={PERIM}
            strokeOpacity={reduced ? 0.26 : 0}
            strokeDashoffset={reduced ? 0 : PERIM}
          >
            {!reduced && (
              <>
                {/* Dashoffset: full at drift → 0 by gather end → stays 0 through hold → stays 0 through disform (opacity handles the fade). */}
                <animate
                  attributeName="stroke-dashoffset"
                  dur={MASTER}
                  keyTimes={`0;${KT.gatherStart};${KT.gatherEnd};${KT.holdEnd};${KT.disformEnd};1`}
                  values={`${PERIM};${PERIM};0;0;0;${PERIM}`}
                  calcMode="spline"
                  keySplines={`0 0 1 1;${EASE};0 0 1 1;0 0 1 1;0 0 1 1`}
                  repeatCount="indefinite"
                />
                {/* Opacity envelope — 0 → 0 → 0.32 → 0.32 → 0 → 0 */}
                <animate
                  attributeName="stroke-opacity"
                  dur={MASTER}
                  keyTimes={`0;${KT.gatherStart};${KT.gatherEnd};${KT.holdEnd};${KT.disformEnd};1`}
                  values="0;0;0.32;0.32;0;0"
                  calcMode="spline"
                  keySplines={`0 0 1 1;${EASE};0 0 1 1;${EASE};0 0 1 1`}
                  repeatCount="indefinite"
                />
              </>
            )}
          </path>

        </g>

        {/* ── Ambient drifters — stationary twinkle, no position motion ── */}
        {DRIFTERS.map((p, i) => {
          const base = 0.08 + rng(2000 + i) * 0.05;
          const peak = 0.18 + rng(2100 + i) * 0.10;
          const dur = 7 + rng(2200 + i) * 6;
          const delay = rng(2300 + i) * 5;
          return (
            <circle key={`dr-${i}`} cx={p.x} cy={p.y} r={p.r} fill={COPPER} opacity={reduced ? (base + peak) / 2 : base}>
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

        {/* ── Travellers — short bezier drift between two anchors ───── */}
        {!reduced && TRAVELLERS.map((t, i) => {
          // Mid-point curves the path gently.
          const mx = (t.from[0] + t.to[0]) / 2 + (rng(3000 + i) - 0.5) * 22;
          const my = (t.from[1] + t.to[1]) / 2 + (rng(3100 + i) - 0.5) * 22;
          const d = `M ${t.from[0]} ${t.from[1]} Q ${mx} ${my} ${t.to[0]} ${t.to[1]}`;
          return (
            <circle key={`tr-${i}`} r={t.r} fill={COPPER} opacity={0.22}>
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
                values="0.08;0.28;0.08"
                dur={`${t.dur}s`}
                begin={`${t.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          );
        })}
        {/* Reduced-motion travellers — render as static points at their start anchor. */}
        {reduced && TRAVELLERS.map((t, i) => (
          <circle key={`tr-static-${i}`} cx={t.from[0]} cy={t.from[1]} r={t.r} fill={COPPER} opacity={0.18} />
        ))}

        {/* ── Vertex motes — the hero "form the prism" motes ───────── */}
        {VERTS.map((v, i) => {
          const rest = VERT_RESTS[i]!;
          const stagger = i * 0.3; // seconds
          const kt = `0;${KT.gatherStart};${KT.gatherEnd};${KT.holdEnd};${KT.disformEnd};1`;

          if (reduced) {
            // Static tableau — motes on vertices at gentle opacity.
            return (
              <circle
                key={`vm-${i}`}
                cx={v[0]} cy={v[1]} r={1.4}
                fill={PALE_YELLOW}
                opacity={0.5}
              />
            );
          }

          // x: rest → rest → vertex → vertex → rest → rest
          const xs = `${rest[0]};${rest[0]};${v[0]};${v[0]};${rest[0]};${rest[0]}`;
          const ys = `${rest[1]};${rest[1]};${v[1]};${v[1]};${rest[1]};${rest[1]}`;
          // opacity: 0.35 drift → 0.35 → 0.9 vertex → 0.9 → 0.35 drift → 0.35
          const os = '0.35;0.35;0.9;0.9;0.35;0.35';
          const splines = `0 0 1 1;${EASE};0 0 1 1;${EASE};0 0 1 1`;

          return (
            <circle
              key={`vm-${i}`}
              cx={rest[0]}
              cy={rest[1]}
              r={1.4}
              fill={PALE_YELLOW}
              opacity={0.35}
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
