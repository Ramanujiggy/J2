// BeltBar — renders a BJJ belt accent bar sized to its parent width.
// Main belt colour on the left, a dark stripe patch on the right,
// with thin white stripe bars for each degree (0–4).

export type BeltRank = 'white' | 'blue' | 'purple' | 'brown' | 'black';

const BELT_COLORS: Record<BeltRank, string> = {
  white:  '#C8C4BF',  // off-white — visible on dark background
  blue:   '#1E4D8C',
  purple: '#6B2D8B',
  brown:  '#7B4A2D',
  black:  '#2A2828',  // near-black — distinct from the app background
};

// The stripe patch is always near-black so white stripes read clearly.
const PATCH_BG = '#0D0D0D';

interface BeltBarProps {
  rank?: string | null;
  stripes?: number;
}

export default function BeltBar({ rank, stripes = 0 }: BeltBarProps) {
  const beltColor = rank ? (BELT_COLORS[rank as BeltRank] ?? null) : null;

  // Don't render anything until a rank is set.
  if (!beltColor) return null;

  const clampedStripes = Math.min(Math.max(Math.round(stripes), 0), 4);

  return (
    <div
      style={{
        display: 'flex',
        height: '7px',
        borderRadius: '3px',
        overflow: 'hidden',
        marginTop: '4px',
      }}
    >
      {/* Main belt — fills available width */}
      <div style={{ flex: 1, backgroundColor: beltColor }} />

      {/* Stripe patch — fixed proportion, dark rectangle */}
      <div
        style={{
          width: '22%',
          backgroundColor: PATCH_BG,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Stripe bars — evenly distributed vertical lines */}
        {Array.from({ length: clampedStripes }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#FFFFFF',
              // Evenly space: stripe i of N at position (i+1)/(N+1) * 100%
              left: `${((i + 1) / (clampedStripes + 1)) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
