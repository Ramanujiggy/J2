// MiniPrismField — a constellation of small pentagons with occasional
// hairline connections drawing between them. Designed for ambient
// backgrounds where there's negative space to fill but no focal motif
// (the focal Prism lives elsewhere — see PrismMotif.tsx). Refero anchors:
// Stardust constellation, Endel particle field, 222 hairline composition.
//
// Two motion layers:
//   1. Each mini-pentagon belongs to one of three groups; each group fades
//      in/out on a 36s cycle phase-staggered by 12s, so ~6 of N are visible
//      at any instant (where N is the prism count).
//   2. Crystallization lines — pre-defined endpoint pairs animate stroke-
//      dashoffset (line draws in) + stroke-opacity (fades out) on a 72s
//      parent cycle, staggered so a connection is visible roughly every
//      24 seconds.
//
// All scattering is deterministic (no Math.random()) so SSR matches client
// and the layout doesn't shift on remount.

import { useMemo, useSyncExternalStore } from 'react';
import { COPPER } from '../../lib/theme.ts';

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

export interface MiniPrism {
  /** Center x in viewBox coords. */
  x: number;
  /** Center y in viewBox coords. */
  y: number;
  /** Outer radius in viewBox coords. */
  r: number;
  /** Phase group 0..2 — controls when this prism is bright vs. dim. */
  group: 0 | 1 | 2;
}

/** A pair of indexes into the `prisms` array — defines a crystallization
 *  line between two mini-pentagons. */
export type CrystPair = [number, number];

export interface MiniPrismFieldProps {
  /** ViewBox width (defines the coordinate system used by `prisms`). */
  viewBoxWidth: number;
  /** ViewBox height. */
  viewBoxHeight: number;
  /** Hand-placed mini-prisms. Use deterministic positions for stable layout. */
  prisms: MiniPrism[];
  /** Endpoint pairs for crystallization lines. Each animates on a 72s cycle
   *  staggered by 24s × index. Default [] (no lines). */
  crystPairs?: CrystPair[];
  /** Stroke color. Default brand copper. */
  color?: string;
  /** Peak opacity of a "bright" mini-prism. Default 0.10. */
  brightOpacity?: number;
  /** Peak opacity of a crystallization line. Default 0.18. */
  linePeakOpacity?: number;
  /** Stroke width of a mini-prism. Default 0.9. */
  strokeWidth?: number;
  /** Stroke width of a crystallization line. Default 0.6. */
  lineStrokeWidth?: number;
  /** Override the wrapping <svg>'s style. Default position: absolute,
   *  inset: 0, full-bleed, pointer-events: none. */
  style?: React.CSSProperties;
}

function pentagonPath(cx: number, cy: number, r: number): string {
  return Array.from({ length: 5 }).map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ') + ' Z';
}

export default function MiniPrismField({
  viewBoxWidth,
  viewBoxHeight,
  prisms,
  crystPairs = [],
  color = COPPER,
  brightOpacity = 0.10,
  linePeakOpacity = 0.18,
  strokeWidth = 0.9,
  lineStrokeWidth = 0.6,
  style,
}: MiniPrismFieldProps) {
  const reduced = usePrefersReducedMotion();

  // Pre-compute path d-strings + line geometries.
  const items = useMemo(
    () => prisms.map((p, idx) => ({
      key: `mini-${idx}`,
      d: pentagonPath(p.x, p.y, p.r),
      group: p.group,
    })),
    [prisms],
  );

  const crystGeoms = useMemo(
    () => crystPairs.map(([a, b], idx) => {
      const pa = prisms[a]!;
      const pb = prisms[b]!;
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      return {
        key: `cryst-${idx}`,
        x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
        len,
        beginSec: idx * 24,
      };
    }),
    [crystPairs, prisms],
  );

  return (
    <svg
      aria-hidden
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'block',
        ...style,
      }}
    >
      {/* Mini-pentagons — fade in groups of three on a 36s cycle. */}
      {items.map(({ key, d, group }) => {
        const begin = group * 12;
        return (
          <path
            key={key}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            opacity={reduced ? brightOpacity * 0.6 : 0}
          >
            {!reduced && (
              <animate
                attributeName="opacity"
                values={`0;${brightOpacity};${brightOpacity};0;0`}
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

      {/* Crystallization lines — copper hairlines that draw in, hold, fade.
          Skipped entirely under reduced-motion. */}
      {!reduced && crystGeoms.map(({ key, x1, y1, x2, y2, len, beginSec }) => (
        <line
          key={key}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color}
          strokeWidth={lineStrokeWidth}
          strokeOpacity={0}
          strokeDasharray={len}
          strokeDashoffset={len}
        >
          <animate
            attributeName="stroke-dashoffset"
            values={`${len};0;0;0;${len};${len}`}
            keyTimes="0;0.025;0.08;0.111;0.139;1"
            dur="72s"
            begin={`${beginSec}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-opacity"
            values={`0;${linePeakOpacity};${linePeakOpacity};0;0`}
            keyTimes="0;0.025;0.111;0.139;1"
            dur="72s"
            begin={`${beginSec}s`}
            repeatCount="indefinite"
          />
        </line>
      ))}
    </svg>
  );
}
