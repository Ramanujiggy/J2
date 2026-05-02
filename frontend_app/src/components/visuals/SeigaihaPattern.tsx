// SeigaihaPattern — single source of truth for the Japanese fish-scale
// (青海波) wave tile that's part of Journada's leather-bound register. Was
// previously implemented three separate ways: inline in WaveBackground.tsx
// (mobile header), inline in RailAmbient.tsx (desktop rail), and as a CSS
// background `.j2-seigaiha-bg`. This component subsumes the SVG variants
// and lets each surface tune via props.
//
// Usage:
//   <SeigaihaPattern />                                  -- default mobile-style
//   <SeigaihaPattern tileSize={48} alpha={0.06} />       -- desktop ambient (rail)
//   <SeigaihaPattern driftSeconds={36} />                -- slow drift for ambient layers
//
// Renders an absolutely-positioned full-bleed SVG with `pointer-events:none`
// so it's safe to drop behind any content surface.

import { useId } from 'react';
import { COPPER, PAGE_BG } from '../../lib/theme.ts';

export interface SeigaihaPatternProps {
  /** Side length of the repeating square tile, in px. Smaller = denser
   *  texture. Mobile header uses 36; desktop rail uses 48. Default 36. */
  tileSize?: number;
  /** Stroke color of the arcs. Default brand copper. */
  color?: string;
  /** Multiplier on the arcs' resting opacity (0..1). Mobile uses ~1
   *  (full opacity arcs visible behind a semi-transparent header).
   *  Ambient backgrounds use 0.04–0.08. Default 1. */
  alpha?: number;
  /** Seconds for one diagonal drift loop. Mobile uses 12.2s for kinetic
   *  feel; desktop ambient uses 36s for whisper. Default 12.2. */
  driftSeconds?: number;
  /** Set true if this layer sits directly on the page background and should
   *  paint a solid `PAGE_BG` rect under each tile (covers any pre-existing
   *  paint). Default false — most ambient placements layer over an existing
   *  surface and want the tile transparent. */
  fillTileBackground?: boolean;
  /** Override the wrapping <svg>'s style. By default the component is
   *  position: absolute, inset: 0, full-bleed, pointer-events: none. */
  style?: React.CSSProperties;
}

export default function SeigaihaPattern({
  tileSize = 36,
  color = COPPER,
  alpha = 1,
  driftSeconds = 12.2,
  fillTileBackground = false,
  style,
}: SeigaihaPatternProps) {
  // useId guarantees uniqueness if multiple instances live on the page
  // simultaneously (e.g. mobile header + a card-watermark variant).
  const uid = useId();
  const patternId = `seigaiha-${uid}`;
  const animationId = `seigaiha-drift-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Tile arcs scale with tile size. Three concentric arcs per anchor; the
  // ratios (outer/mid/inner = 1.0/0.72/0.39) and stroke ratios are tuned
  // from the prior mobile WaveBackground at tileSize=36.
  const T = tileSize;
  const arcs = [
    { r: T * 0.50, strokeWidth: T * 0.050, strokeOpacity: 0.70 },
    { r: T * 0.36, strokeWidth: T * 0.039, strokeOpacity: 0.55 },
    { r: T * 0.19, strokeWidth: T * 0.028, strokeOpacity: 0.40 },
  ] as const;

  const anchors = [
    { cx: 0,     cy: T / 2 },
    { cx: T,     cy: T / 2 },     // right-edge bleed (pairs with x=0 of adjacent tile)
    { cx: T / 2, cy: T },         // bottom-edge bleed (staggered row for half-drop)
  ] as const;

  function arcPath(cx: number, cy: number, r: number): string {
    return `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
  }

  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: alpha,
        ...style,
      }}
    >
      <defs>
        <pattern id={patternId} width={T} height={T} patternUnits="userSpaceOnUse">
          {fillTileBackground && <rect width={T} height={T} fill={PAGE_BG} />}
          {anchors.map(({ cx, cy }) => (
            <g key={`${cx}-${cy}`} fill="none" strokeLinecap="round">
              {arcs.map(({ r, strokeWidth, strokeOpacity }) => (
                <path
                  key={r}
                  d={arcPath(cx, cy, r)}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                />
              ))}
            </g>
          ))}
        </pattern>
      </defs>

      {/* Oversized rect so the tile-sized translate at the loop end never
          reveals a gap at any edge. */}
      <g style={{ animation: `${animationId} ${driftSeconds}s linear infinite` }}>
        <rect x={-T} y={-T} width="10000" height="3000" fill={`url(#${patternId})`} />
      </g>

      <style>{`
        @keyframes ${animationId} {
          from { transform: translate(0px, 0px); }
          to   { transform: translate(${T}px, ${-T}px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-seigaiha="${uid}"] g { animation: none !important; }
        }
      `}</style>
    </svg>
  );
}
