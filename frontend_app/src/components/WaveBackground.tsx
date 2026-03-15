// Seamless 36×36 seigaiha (Japanese fish-scale / wave) tile — deep navy + muted copper/clay.
//
// Layout: half-drop staggered repeat.
//   Row 1 (cy=18): anchors at x=0, 36  ← x=36 is the right-edge bleed that pairs
//                                          with x=0 of the adjacent tile.
//   Row 2 (cy=36): anchor at x=18      ← staggered +18 for the interlocking scale effect.
//
// Each motif: three concentric upward-facing semicircular arcs (outer r=20, mid r=14, inner r=8).

const BG     = '#111e2b'; // brand-dark — matches app palette
const COPPER = '#B87A55'; // muted copper / clay

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
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <defs>
        <pattern id="jw-tile" width="36" height="36" patternUnits="userSpaceOnUse">

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

      <rect width="100%" height="100%" fill="url(#jw-tile)" />
    </svg>
  );
}
