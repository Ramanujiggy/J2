// Ambient rail background — v4. Composer-only.
//
// Per user feedback ("rail was too cluttered, take out the big prism animation
// and save that for reuse somewhere else"), this revision is a thin composer
// that layers three primitives:
//   1. A copper seigaiha (Japanese fish-scale wave) tile, drifting at 36s,
//      at 5% alpha — the parchment grain.
//   2. A constellation of 6 mini-pentagons in three phase-staggered groups,
//      with two crystallization-line moments that draw between them on a
//      72s cycle.
//   3. (Removed: focal Prism, halo, edge mote, starfield, vertical anchor
//      gradient — see PrismMotif.tsx for the extracted focal symbol.)
//
// All three primitives are themselves reusable components in
// `components/visuals/`. This file's only job is to define the rail's
// coordinate system + the hand-placed mini-prism positions, and compose.

import SeigaihaPattern from './visuals/SeigaihaPattern.tsx';
import MiniPrismField, { type MiniPrism, type CrystPair } from './visuals/MiniPrismField.tsx';

// Rail coordinate system — matches the desktop rail's 280×1000 design grid.
// Mini-prism positions live in this space.
const RAIL_W = 280;
const RAIL_H = 1000;

// Six hand-placed mini-pentagons. Distributed across the rail's negative
// space, avoiding (a) the wordmark/tagline band (y < 110), (b) the nav band
// (y 110–340) center, and (c) the practitioner pill band (y > 870). Three
// groups of two — when one group fades out, four remain visible.
const RAIL_MINIS: MiniPrism[] = [
  { x:  56, y:  72, r:  9, group: 0 },
  { x: 222, y:  88, r: 12, group: 1 },
  { x:  18, y: 470, r:  9, group: 2 },
  { x: 262, y: 510, r: 10, group: 0 },
  { x:  68, y: 740, r: 13, group: 1 },
  { x: 210, y: 760, r: 10, group: 2 },
];

// Two pre-defined crystallization connections. With the focal Prism gone
// these are the rail's most kinetic moments — keep them sparse (every ~36s
// a line briefly draws). Endpoints chosen so neither line crosses the nav
// band's vertical center.
const RAIL_CRYST: CrystPair[] = [
  [0, 4], // top-left → bottom-left
  [1, 5], // top-right → bottom-right
];

export default function RailAmbient() {
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
      {/* Layer 1 — seigaiha texture, drifts diagonally. 5% alpha is a touch
          higher than the prior 4% to compensate for the focal Prism's
          removal (Refero rule of thumb: "when the focal vanishes, the
          texture rises ~50% of the lost mass — never 100%"). */}
      <SeigaihaPattern tileSize={48} alpha={0.05} driftSeconds={36} />

      {/* Layer 2 — constellation of mini-pentagons + occasional connecting
          lines. The most kinetic thing on the rail now. */}
      <MiniPrismField
        viewBoxWidth={RAIL_W}
        viewBoxHeight={RAIL_H}
        prisms={RAIL_MINIS}
        crystPairs={RAIL_CRYST}
      />
    </div>
  );
}
