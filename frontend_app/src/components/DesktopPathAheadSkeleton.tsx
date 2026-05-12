// DesktopPathAheadSkeleton — placeholder shape rendered during the initial
// data fetch on Path Ahead's desktop layout. Replaces the empty-state flash
// (the `FirstVisitCard` momentarily painting before sessions arrive).
//
// Brand register: forest-tinted SURFACE_2 boxes with a copper hairline
// border and a copper-gradient sweep traveling across via the
// `j2-skeleton-sweep` keyframe in index.css. Mirrors the `j2-streak-sheen`
// motion vocabulary already in the app — quiet, ambient, never gym-bro.
//
// Layout shape mirrors PathAheadPage's actual desktop grid: hero header,
// stat strip, intention card, week view, primary CTA, plus a right-rail
// of three secondary cards. Pure geometry — no copy, no real data.

import { SURFACE_2, CARD_GLOW_BORDER } from '../lib/theme.ts';

interface SkeletonBoxProps {
  height: number | string;
  radius?: number;
  delay?: number;
  className?: string;
}

// One placeholder box — handles the surface, border, opacity breathe, and
// the inner copper-gradient sweep. The `delay` prop staggers the sweep
// across boxes so they don't fire in unison.
function SkeletonBox({ height, radius = 16, delay = 0, className = '' }: SkeletonBoxProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height,
        borderRadius: radius,
        background: SURFACE_2,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        overflow: 'hidden',
        animation: `j2-skeleton-breathe 2400ms ease-in-out infinite ${delay}ms`,
        willChange: 'opacity',
      }}
      aria-hidden
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(196,145,95,0.18) 50%, transparent 100%)',
          animation: `j2-skeleton-sweep 3600ms ease-in-out infinite ${delay + 400}ms`,
          willChange: 'transform',
        }}
      />
    </div>
  );
}

export default function DesktopPathAheadSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your training data"
      style={{
        maxWidth: 1680,
        margin: '0 auto',
        padding: '64px 64px 104px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
      }}
    >
      {/* Header strip — greeting + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
        <SkeletonBox height={56} radius={12} delay={0}   className="flex-1" />
        <SkeletonBox height={44} radius={10} delay={120} className="w-[180px]" />
        <SkeletonBox height={54} radius={12} delay={240} className="w-[200px]" />
      </div>

      {/* Stat strip — 4 metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
        <SkeletonBox height={120} radius={16} delay={0}   />
        <SkeletonBox height={120} radius={16} delay={140} />
        <SkeletonBox height={120} radius={16} delay={280} />
        <SkeletonBox height={120} radius={16} delay={420} />
      </div>

      {/* Hero + right rail (2-col) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 56, alignItems: 'start' }}>
        {/* Left column — hero + week + CTA + heatmap stub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SkeletonBox height={220} radius={20} delay={0} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonBox key={i} height={88} radius={12} delay={80 + i * 60} />
            ))}
          </div>
          <SkeletonBox height={60}  radius={14} delay={500} />
          <SkeletonBox height={140} radius={16} delay={620} />
        </div>

        {/* Right rail — 3 stacked cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <SkeletonBox height={180} radius={16} delay={200} />
          <SkeletonBox height={220} radius={16} delay={360} />
          <SkeletonBox height={220} radius={16} delay={520} />
        </div>
      </div>
    </div>
  );
}
