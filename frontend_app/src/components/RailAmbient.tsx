// Ambient rail background — quiet, subdued versions of the onboarding heroes
// the user loved: motes drifting inward to form a pentagon (HeroWelcome), and
// a flowing signature line that draws itself and fades (HeroName).
//
// Design rules:
//   • Never grabs attention. Opacities 0.05–0.18, strokes ≤ 0.7.
//   • Slower loops than onboarding (26–32s) so nothing blinks or syncs with
//     the user's scan rhythm.
//   • Fills the rail behind content — absolute, pointer-events: none, z-index 0.
//   • Accent only — no fills, no filters that can stack (hurts perf on older GPUs).

import { COPPER, PALE_YELLOW } from '../lib/theme.ts';

// Deterministic tiny PRNG — same scatter pattern every mount, no React state.
function rng(seed: number): number {
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Pentagon vertex set in normalized-ish SVG coords around (cx, cy, R).
function pentVerts(cx: number, cy: number, R: number): [number, number][] {
  return Array.from({ length: 5 }).map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as [number, number];
  });
}

export default function RailAmbient() {
  // Upper pentagon block — sits behind the wordmark + nav top area.
  const UP_W = 280;
  const UP_H = 360;
  const upCx = UP_W / 2;
  const upCy = UP_H / 2 + 20;
  const upR  = 58;
  const verts = pentVerts(upCx, upCy, upR);
  const pathD =
    verts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';

  // Starting points for the motes — scattered well outside the pentagon.
  const starts = verts.map((_, i) => {
    const rx = (rng(i * 7) - 0.5) * UP_W * 1.8;
    const ry = (rng(i * 11 + 3) - 0.5) * UP_H * 0.9;
    return [upCx + rx, upCy + ry] as [number, number];
  });

  // A few ambient drifting motes scattered across the top block (no pattern,
  // just brownian gentle twinkle — helps the pentagon not feel like a logo).
  const drifters = Array.from({ length: 10 }).map((_, i) => ({
    x: rng(i + 100) * UP_W,
    y: rng(i + 200) * UP_H,
    r: 0.4 + rng(i + 300) * 0.8,
    delay: rng(i + 400) * 8,
    dur:   6 + rng(i + 500) * 6,
  }));

  // Lower wavy signature block — sits behind the middle of the rail (between
  // focus card and practitioner pill), 280px wide like the rail.
  const LO_W = 280;
  const LO_H = 140;
  // Same hand-drawn feel as HeroName, scaled to rail width.
  const sigD = 'M 20 88 C 42 34, 74 108, 98 80 S 132 46, 156 76 S 194 104, 220 72 S 254 38, 268 82';

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        // z-index: -1 paired with `isolation: isolate` on the rail aside
        // keeps the ambient layer underneath in-flow flex children (wordmark,
        // nav, focus card, practitioner pill) without leaking behind the rail.
        zIndex: -1,
      }}
    >
      {/* ── Upper pentagon motes ──────────────────────────────────── */}
      <svg
        width={UP_W}
        height={UP_H}
        viewBox={`0 0 ${UP_W} ${UP_H}`}
        style={{
          position: 'absolute',
          top: 80,          // starts just below the wordmark
          left: 0,
          opacity: 0.55,    // master dim — keeps the whole thing polite
        }}
      >
        <defs>
          <radialGradient id="rail-amb-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={PALE_YELLOW} stopOpacity="0.08" />
            <stop offset="70%" stopColor={PALE_YELLOW} stopOpacity="0.00" />
          </radialGradient>
        </defs>

        {/* very faint center glow */}
        <circle cx={upCx} cy={upCy} r={upR * 1.9} fill="url(#rail-amb-glow)" />

        {/* static faint pentagon so motionless stills still read */}
        <path
          d={pathD}
          fill="none"
          stroke={COPPER}
          strokeWidth={0.4}
          strokeLinejoin="round"
          opacity={0.18}
        />

        {/* drifting ambient motes — quiet twinkle */}
        {drifters.map((p, i) => (
          <circle key={`dr-${i}`} cx={p.x} cy={p.y} r={p.r} fill={COPPER} opacity={0.22}>
            <animate
              attributeName="opacity"
              values="0.08;0.35;0.08"
              dur={`${p.dur}s`}
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* pentagon draws in, holds, fades — 28s loop */}
        <path
          d={pathD}
          fill="none"
          stroke={PALE_YELLOW}
          strokeWidth={0.6}
          strokeLinejoin="round"
          strokeDasharray="600"
          opacity={0}
        >
          <animate
            attributeName="stroke-dashoffset"
            values="600;0;0;600"
            dur="28s"
            keyTimes="0;0.35;0.75;1"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.45;0.45;0"
            dur="28s"
            keyTimes="0;0.35;0.75;1"
            repeatCount="indefinite"
          />
        </path>

        {/* static vertex pips so stills read */}
        {verts.map((v, i) => (
          <circle key={`sv-${i}`} cx={v[0]} cy={v[1]} r={0.9} fill={COPPER} opacity={0.35} />
        ))}

        {/* five motes travelling from far points to each vertex */}
        {verts.map((v, i) => (
          <g key={`mote-${i}`}>
            <line
              x1={starts[i]![0]} y1={starts[i]![1]}
              x2={v[0]} y2={v[1]}
              stroke={COPPER}
              strokeWidth={0.25}
              opacity={0}
            >
              <animate
                attributeName="opacity"
                values="0;0.18;0;0"
                dur="28s"
                keyTimes="0;0.3;0.5;1"
                begin={`${i * 0.6}s`}
                repeatCount="indefinite"
              />
            </line>
            <circle r={1.1} fill={PALE_YELLOW} opacity={0}>
              <animate
                attributeName="cx"
                values={`${starts[i]![0]};${v[0]};${v[0]};${starts[i]![0]}`}
                keyTimes="0;0.35;0.75;1"
                dur="28s"
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values={`${starts[i]![1]};${v[1]};${v[1]};${starts[i]![1]}`}
                keyTimes="0;0.35;0.75;1"
                dur="28s"
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.7;0.7;0"
                keyTimes="0;0.35;0.75;1"
                dur="28s"
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>

      {/* ── Lower wavy signature drift ────────────────────────────── */}
      {/* Sits ~60% down the rail, anchored from the bottom so it shows up
          behind the practitioner pill area without crowding the focus card. */}
      <svg
        width={LO_W}
        height={LO_H}
        viewBox={`0 0 ${LO_W} ${LO_H}`}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 200,      // above the practitioner pill (~180px tall w/ belt bar)
          opacity: 0.42,
        }}
      >
        <defs>
          <linearGradient id="rail-amb-sig" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={COPPER}      stopOpacity="0.0" />
            <stop offset="20%"  stopColor={COPPER}      stopOpacity="0.35" />
            <stop offset="50%"  stopColor={PALE_YELLOW} stopOpacity="0.65" />
            <stop offset="80%"  stopColor={COPPER}      stopOpacity="0.35" />
            <stop offset="100%" stopColor={COPPER}      stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* faint dashed baseline — same treatment as HeroName */}
        <line
          x1="20" y1="108" x2="260" y2="108"
          stroke={COPPER}
          strokeWidth={0.3}
          opacity={0.2}
          strokeDasharray="2 4"
        />

        {/* signature stroke draws → holds → erases (32s loop) */}
        <path
          d={sigD}
          fill="none"
          stroke="url(#rail-amb-sig)"
          strokeWidth={0.9}
          strokeLinecap="round"
          strokeDasharray="600"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="600;0;0;-600"
            keyTimes="0;0.4;0.75;1"
            dur="32s"
            repeatCount="indefinite"
          />
        </path>

        {/* travelling tip mote — leads the stroke */}
        <circle r={1.4} fill={PALE_YELLOW} opacity={0}>
          <animateMotion
            dur="32s"
            repeatCount="indefinite"
            keyTimes="0;0.4;0.75;1"
            keyPoints="0;1;1;1"
            calcMode="linear"
            path={sigD}
          />
          <animate
            attributeName="opacity"
            values="0;0.8;0.8;0;0"
            keyTimes="0;0.05;0.4;0.42;1"
            dur="32s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}
