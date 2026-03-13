// BeltBar — renders a BJJ belt accent bar sized to its parent width.
// Main belt colour on the left, a dark stripe patch on the right,
// with thin white stripe bars for each degree (0–4).
// Animates from left: unfurls to full width when first mounted.

import { useState, useEffect } from 'react';

export type BeltRank = 'white' | 'blue' | 'purple' | 'brown' | 'black';

const BELT_COLORS: Record<BeltRank, string> = {
  white:  '#C8C4BF',  // off-white — visible on dark background
  blue:   '#1E4D8C',
  purple: '#6B2D8B',
  brown:  '#7B4A2D',
  black:  '#1C1C1C',  // near-black — distinct from app background
};

// Patch color per rank — black belt gets a red patch, all others near-black.
const PATCH_COLORS: Record<BeltRank, string> = {
  white:  '#0D0D0D',
  blue:   '#0D0D0D',
  purple: '#0D0D0D',
  brown:  '#0D0D0D',
  black:  '#C41E3A',
};

interface BeltBarProps {
  rank?: string | null;
  stripes?: number;
}

export default function BeltBar({ rank, stripes = 0 }: BeltBarProps) {
  const beltRank = rank as BeltRank | null;
  const beltColor = beltRank ? (BELT_COLORS[beltRank] ?? null) : null;
  const patchColor = beltRank ? (PATCH_COLORS[beltRank] ?? '#0D0D0D') : '#0D0D0D';

  // Don't render anything until a rank is set.
  if (!beltColor) return null;

  const clampedStripes = Math.min(Math.max(Math.round(stripes), 0), 4);

  return <BeltBarInner beltColor={beltColor} patchColor={patchColor} stripes={clampedStripes} />;
}

function BeltBarInner({
  beltColor,
  patchColor,
  stripes,
}: {
  beltColor: string;
  patchColor: string;
  stripes: number;
}) {
  // Unfurl animation: mount at maxWidth 0, then let CSS transition reveal to 100%.
  const [unrolled, setUnrolled] = useState(false);
  useEffect(() => {
    // Small delay so the browser paints the initial 0-width state first.
    const id = setTimeout(() => setUnrolled(true), 20);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        height: '7px',
        borderRadius: '3px',
        overflow: 'hidden',
        marginTop: '4px',
        maxWidth: unrolled ? '100%' : '0',
        transition: 'max-width 0.55s cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
    >
      {/* Main belt — fills available width */}
      <div style={{ flex: 1, backgroundColor: beltColor }} />

      {/* Stripe patch — fixed proportion; red for black belt, near-black otherwise */}
      <div
        style={{
          width: '22%',
          backgroundColor: patchColor,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Stripe bars — evenly distributed vertical lines */}
        {Array.from({ length: stripes }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#FFFFFF',
              // Evenly space: stripe i of N at position (i+1)/(N+1) * 100%
              left: `${((i + 1) / (stripes + 1)) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
