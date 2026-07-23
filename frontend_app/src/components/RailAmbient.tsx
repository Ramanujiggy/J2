// Ambient rail background — v5. Single-layer.
//
// Per design-system cleanup (2026-06): the MiniPrismField was pulling
// attention away from the editorial nav. With the focal Prism already gone
// (extracted to PrismMotif.tsx) and the constellation now gone too, the
// rail's only ambient layer is the seigaiha texture — slow drift, very low
// alpha, parchment grain. Reads as material, not motion.

import SeigaihaPattern from './visuals/SeigaihaPattern.tsx';

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
      {/* Single ambient layer — seigaiha texture, drifting on a slow 60s
          cycle so the motion lives on the edge of perception. 5% alpha is
          the parchment grain; anything heavier started reading as a busy
          background instead of material. */}
      <SeigaihaPattern tileSize={48} alpha={0.05} driftSeconds={60} />
    </div>
  );
}
