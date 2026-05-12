// WaveBackground — mobile header backdrop. Now a thin wrapper around the
// canonical SeigaihaPattern primitive in `components/visuals/`. Mobile
// uses a denser tile (36px) and a kinetic drift speed (12.2s) since the
// header is small and the user's eye is close.
//
// Kept as a named component for backwards-compatible imports. New code
// should prefer `<SeigaihaPattern tileSize={36} driftSeconds={12.2} />`
// directly.

import SeigaihaPattern from './visuals/SeigaihaPattern.tsx';

export default function WaveBackground() {
  return <SeigaihaPattern tileSize={36} driftSeconds={12.2} fillTileBackground />;
}
