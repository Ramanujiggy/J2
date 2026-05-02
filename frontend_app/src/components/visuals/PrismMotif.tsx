// PrismMotif — the focal "Journada Prism" pentagon, extracted from the
// original RailAmbient v3 rewrite. This is the brand's hero symbol. Reserve
// `intensity="hero"` for FOUR surfaces only (per Refero meta-principle "one
// symbol, recurring at different scales — texture under, focal over, never
// both at once"):
//
//   1. Atlas page header (the tab is literally named Prism)
//   2. Onboarding "set your focus" — vertices light as user picks pillars
//   3. Annual recap takeover ("Your Year, the Prism") — vertex weights
//      proportional to per-pillar volume
//   4. 8th-gate prestige / achievement moments
//
// Whisper / medium intensity is fine for backgrounds (empty journal entry,
// notification primer card watermark, etc.).
//
// Composition: halo (blurred wide stroke) + ghost (always-on hairline
// reference) + crisp stroke (breathes opacity) + vertex pinpoints. All
// three opacity layers breathe in lockstep on a 12s clock so the symbol
// reads as one object, not three layered effects.

import { useId, useSyncExternalStore } from 'react';
import { COPPER, PALE_YELLOW } from '../../lib/theme.ts';

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

export type PrismIntensity = 'whisper' | 'medium' | 'hero';
export type PrismBreathRate = 'still' | 'slow' | 'moderate';
export type PrismColor = 'copper' | 'champagne' | 'auto';

export interface PrismMotifProps {
  /** Pixel size of the bounding square. The pentagon is centered and sized
   *  to fit. Default 320. */
  size?: number;
  /** Visual weight. whisper = background watermark; medium = card chrome;
   *  hero = focal centerpiece. Drives baseline + peak opacity of all three
   *  layers. Default 'medium'. */
  intensity?: PrismIntensity;
  /** Breath cycle. 'still' = no animation; 'slow' = 12s; 'moderate' = 8s.
   *  Default 'slow'. */
  breathRate?: PrismBreathRate;
  /** Stroke / vertex color. 'auto' uses copper for stroke + champagne for
   *  vertices (the canonical render). 'champagne' single-hue is for prestige
   *  moments. 'copper' single-hue is for muted/secondary placements. */
  color?: PrismColor;
  /** Show the 5 vertex pinpoints. Default true. */
  showVertices?: boolean;
  /** Show the blurred halo behind the stroke. Default true. */
  showHalo?: boolean;
  /** Optional per-vertex weights [0..1] — when set, each vertex's pinpoint
   *  size scales by its weight. Used by the annual-recap "your year, the
   *  Prism" surface. Length must be 5. */
  vertexWeights?: [number, number, number, number, number];
  /** Optional className for the wrapping <svg>. */
  className?: string;
  /** Inline style passed to the wrapping <svg>. */
  style?: React.CSSProperties;
}

interface IntensityProfile {
  haloMin: number; haloMax: number;
  strokeMin: number; strokeMax: number;
  vertexMin: number; vertexMax: number;
  ghostOpacity: number;
}

const INTENSITY_TABLE: Record<PrismIntensity, IntensityProfile> = {
  whisper: { haloMin: 0.10, haloMax: 0.18, strokeMin: 0.18, strokeMax: 0.28, vertexMin: 0.22, vertexMax: 0.40, ghostOpacity: 0.04 },
  medium:  { haloMin: 0.32, haloMax: 0.55, strokeMin: 0.50, strokeMax: 0.85, vertexMin: 0.60, vertexMax: 0.95, ghostOpacity: 0.10 },
  hero:    { haloMin: 0.55, haloMax: 0.80, strokeMin: 0.78, strokeMax: 1.00, vertexMin: 0.85, vertexMax: 1.00, ghostOpacity: 0.16 },
};

const BREATH_DUR: Record<PrismBreathRate, string> = {
  still: '0s',
  slow: '12s',
  moderate: '8s',
};

function resolveColors(color: PrismColor): { stroke: string; vertex: string; halo: string } {
  if (color === 'champagne') return { stroke: PALE_YELLOW, vertex: PALE_YELLOW, halo: PALE_YELLOW };
  if (color === 'copper')    return { stroke: COPPER,      vertex: COPPER,      halo: COPPER      };
  // auto — canonical brand pairing
  return { stroke: PALE_YELLOW, vertex: PALE_YELLOW, halo: COPPER };
}

export default function PrismMotif({
  size = 320,
  intensity = 'medium',
  breathRate = 'slow',
  color = 'auto',
  showVertices = true,
  showHalo = true,
  vertexWeights,
  className,
  style,
}: PrismMotifProps) {
  const reduced = usePrefersReducedMotion();
  const uid = useId();
  const haloFilterId = `prism-halo-${uid}`;

  const cx = size / 2;
  const cy = size / 2;
  // Pentagon radius: 0.39 of size leaves comfortable margin for the halo
  // blur (which can extend ~6px outside the stroke) without clipping.
  const r = size * 0.39;

  const verts: [number, number][] = Array.from({ length: 5 }).map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const pathD = verts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';

  const profile = INTENSITY_TABLE[intensity];
  const colors = resolveColors(color);
  const dur = BREATH_DUR[breathRate];
  const animate = !reduced && breathRate !== 'still';
  // Keyframe spline — gentle ease-in-out for breath.
  const splines = '0.4 0 0.6 1;0.4 0 0.6 1';

  // Halo blur radius scales with size so a small Prism doesn't get a halo
  // that visually dominates its body.
  const haloBlurStdDev = Math.max(2, size * 0.012);

  // Vertex base radius — scales with size; vertexWeights modulates per-vertex.
  const vertexBaseR = Math.max(1.4, size * 0.0055);

  // Resting opacities for reduced-motion or 'still' breath: midpoint of the
  // breath range so the symbol still reads at the right weight.
  const restHalo   = (profile.haloMin + profile.haloMax) / 2;
  const restStroke = (profile.strokeMin + profile.strokeMax) / 2;
  const restVertex = (profile.vertexMin + profile.vertexMax) / 2;

  return (
    <svg
      className={className}
      style={{ display: 'block', ...style }}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <defs>
        <filter id={haloFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={haloBlurStdDev} />
        </filter>
      </defs>

      {/* Halo — blurred wide stroke. The primary visible "glow." */}
      {showHalo && (
        <path
          d={pathD}
          fill="none"
          stroke={colors.halo}
          strokeWidth={size * 0.019}
          strokeLinejoin="round"
          filter={`url(#${haloFilterId})`}
          opacity={animate ? profile.haloMin : restHalo}
        >
          {animate && (
            <animate
              attributeName="opacity"
              values={`${profile.haloMin};${profile.haloMax};${profile.haloMin}`}
              keyTimes="0;0.5;1"
              dur={dur}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines={splines}
            />
          )}
        </path>
      )}

      {/* Ghost stroke — always-on faint reference line. Stable shape under
          the breathing crisp stroke. */}
      <path
        d={pathD}
        fill="none"
        stroke={colors.stroke}
        strokeOpacity={profile.ghostOpacity}
        strokeWidth={Math.max(0.6, size * 0.0022)}
        strokeLinejoin="round"
      />

      {/* Crisp stroke — the symbol. Breathes opacity in lockstep with halo. */}
      <path
        d={pathD}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={Math.max(1, size * 0.0032)}
        strokeLinejoin="round"
        opacity={animate ? profile.strokeMin : restStroke}
      >
        {animate && (
          <animate
            attributeName="opacity"
            values={`${profile.strokeMin};${profile.strokeMax};${profile.strokeMin}`}
            keyTimes="0;0.5;1"
            dur={dur}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines={splines}
          />
        )}
      </path>

      {/* Vertex pinpoints — optional. Sizes can be scaled per-vertex via
          `vertexWeights` (annual recap mode). */}
      {showVertices && verts.map((v, i) => {
        const weight = vertexWeights ? Math.max(0, Math.min(1, vertexWeights[i])) : 1;
        const dotR = vertexBaseR * (0.55 + weight * 0.45);
        return (
          <circle
            key={i}
            cx={v[0]}
            cy={v[1]}
            r={dotR}
            fill={colors.vertex}
            opacity={animate ? profile.vertexMin : restVertex}
          >
            {animate && (
              <animate
                attributeName="opacity"
                values={`${profile.vertexMin};${profile.vertexMax};${profile.vertexMin}`}
                keyTimes="0;0.5;1"
                dur={dur}
                repeatCount="indefinite"
                calcMode="spline"
                keySplines={splines}
              />
            )}
          </circle>
        );
      })}
    </svg>
  );
}
