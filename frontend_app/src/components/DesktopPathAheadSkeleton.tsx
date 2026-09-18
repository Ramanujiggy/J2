// DesktopPathAheadSkeleton — placeholder shape rendered during the initial
// data fetch on Today's desktop layout. Replaces the empty-state flash
// (day-one copy momentarily painting before sessions arrive).
//
// Brand register: forest-tinted SURFACE_2 boxes with a copper hairline
// border and a copper-gradient sweep traveling across via the
// `j2-skeleton-sweep` keyframe in index.css. Mirrors the `j2-streak-sheen`
// motion vocabulary already in the app — quiet, ambient, never gym-bro.
//
// The shape tracks the desk it stands in for: prose column (label, title,
// hero, three list rows, portrait) beside the two margin notes. A skeleton
// that outlines a different layout than the one that lands reads as a jump,
// which is the one thing it exists to prevent.

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
    <div role="status" aria-label="Loading your training data" className="j2-desk-page">
      <div className="j2-desk">
        {/* Prose column */}
        <div className="j2-desk-main" style={{ display: 'flex', flexDirection: 'column' }}>
          <SkeletonBox height={12} radius={4} delay={0}   className="w-[180px]" />
          <div style={{ marginTop: 12 }}>
            <SkeletonBox height={34} radius={8} delay={80} className="w-[280px]" />
          </div>
          {/* The hero */}
          <div style={{ marginTop: 26 }}>
            <SkeletonBox height={250} radius={18} delay={160} />
          </div>
          {/* The list — three rows */}
          <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <SkeletonBox height={12} radius={4} delay={240} className="w-[210px]" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ marginTop: 16 }}>
                <SkeletonBox height={46} radius={8} delay={320 + i * 90} />
              </div>
            ))}
          </div>
          {/* The portrait */}
          <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 20 }}>
            <SkeletonBox height={104} radius={52} delay={600} className="w-[104px] flex-none" />
            <SkeletonBox height={56}  radius={8}  delay={660} className="flex-1" />
          </div>
        </div>

        {/* The margin — two notes */}
        <div className="j2-desk-margin" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SkeletonBox height={132} radius={10} delay={200} />
          <SkeletonBox height={148} radius={10} delay={380} />
        </div>
      </div>
    </div>
  );
}
