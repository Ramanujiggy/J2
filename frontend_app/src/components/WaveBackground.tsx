// Seamless 36×36 seigaiha (Japanese fish-scale / wave) tile — deep navy + muted copper/clay.
//
// Layout: half-drop staggered repeat.
//   Row 1 (cy=18): anchors at x=0, 36  ← x=36 is the right-edge bleed that pairs
//                                          with x=0 of the adjacent tile.
//   Row 2 (cy=36): anchor at x=18      ← staggered +18 for the interlocking scale effect.
//
// Each motif: three concentric upward-facing semicircular arcs (outer r=20, mid r=14, inner r=8).

import { useId } from 'react';
import { PAGE_BG as BG, COPPER } from '../lib/theme.ts';

const ARCS = [
  { r: 18, strokeWidth: 1.8, strokeOpacity: 0.70 },
  { r: 13, strokeWidth: 1.4, strokeOpacity: 0.55 },
  { r:  7, strokeWidth: 1.0, strokeOpacity: 0.40 },
] as const;

// Upward-facing semicircular arc centred at (cx, cy)
function arcPath(cx: number, cy: number, r: number): string {
  return `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
}

const ANCHORS = [
  { cx:  0, cy: 18 },
  { cx: 36, cy: 18 }, // right-edge bleed (pairs with x=0 of adjacent tile)
  { cx: 18, cy: 36 }, // bottom-edge bleed (staggered row)
] as const;

export default function WaveBackground() {
  // useId() guarantees a unique ID per instance, preventing pattern collision
  // when multiple WaveBackground components are in the DOM simultaneously.
  const uid = useId();
  const patternId = `jw-tile-${uid}`;

  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <defs>
        <pattern id={patternId} width="36" height="36" patternUnits="userSpaceOnUse">

          {/* Tile background */}
          <rect width="36" height="36" fill={BG} />

          {ANCHORS.map(({ cx, cy }) => (
            <g key={`${cx}-${cy}`} fill="none" strokeLinecap="round">
              {ARCS.map(({ r, strokeWidth, strokeOpacity }) => (
                <path
                  key={r}
                  d={arcPath(cx, cy, r)}
                  stroke={COPPER}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                />
              ))}
            </g>
          ))}

        </pattern>
      </defs>

      {/* Oversized rect so the 36px translate never reveals a gap at any edge */}
      <g style={{ animation: 'jw-drift 12.2s linear infinite' }}>
        <rect x="-36" y="-36" width="10000" height="3000" fill={`url(#${patternId})`} />
      </g>

      <style>{`
        @keyframes jw-drift {
          from { transform: translate(0px,   0px); }
          to   { transform: translate(36px, -36px); }
        }
      `}</style>
    </svg>
  );
}
