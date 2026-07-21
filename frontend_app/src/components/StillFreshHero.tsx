// StillFreshHero — dominant hero card for the home screen.
// Shows the most recent session and invites the user to add notes
// while the session is still fresh. Immersive gradient + scrim + prism mark.

import { COPPER, PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT, SURFACE_2, COPPER_BORDER } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';

interface StillFreshHeroProps {
  lastSession: {
    date: string;         // 'YYYY-MM-DD'
    duration: number;     // minutes
    focusLabel: string;   // e.g. 'Guard & Submissions'
    endedAgo: string;     // e.g. '3h ago', 'yesterday'
  } | null;
  onAddNotes: () => void;
  onDismiss: () => void;
}

const ORANGE = '#DA7422';

/** Inline SVG flame icon — 14x14, copper-tinted. */
function FlameIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        d="M8 1C8 1 3.5 5.5 3.5 9.5C3.5 12 5.5 14 8 14C10.5 14 12.5 12 12.5 9.5C12.5 5.5 8 1 8 1Z"
        fill="rgba(196,145,95,0.55)"
      />
      <path
        d="M8 6C8 6 6 8.5 6 10.2C6 11.2 6.9 12 8 12C9.1 12 10 11.2 10 10.2C10 8.5 8 6 8 6Z"
        fill="rgba(242,228,168,0.6)"
      />
    </svg>
  );
}

/** Small pencil icon — 15x15, white. */
function PencilIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 16 16"
      fill="none"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 3.5L12.5 6.5"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function StillFreshHero({ lastSession, onAddNotes, onDismiss }: StillFreshHeroProps) {
  if (!lastSession) return null;

  const durationStr = formatDuration(lastSession.duration);

  return (
    <div
      style={{
        borderRadius: 20,
        minHeight: 236,
        overflow: 'hidden',
        border: '1px solid var(--j2-border-2)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Background gradient */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(130% 120% at 18% -10%, #21432f 0%, #14291e 52%, #0b1c14 100%)',
        }}
      />

      {/* Bottom scrim for depth */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(8,20,14,0.92) 6%, rgba(8,20,14,0.35) 46%, transparent 70%)',
        }}
      />

      {/* Decorative prism mark — two nested rotated squares, top-right */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          opacity: 0.12,
          pointerEvents: 'none',
        }}
      >
        <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
          <rect
            x={24}
            y={4}
            width={20}
            height={20}
            transform="rotate(45 24 4)"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={1}
            fill="none"
          />
          <rect
            x={24}
            y={8}
            width={14}
            height={14}
            transform="rotate(45 24 8)"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={1}
            fill="none"
          />
        </svg>
      </div>

      {/* Content — padded, flex column filling the min height */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 236,
          flex: 1,
        }}
      >
        {/* Top row — chips */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* "Yesterday" chip */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.50)',
              backgroundColor: SURFACE_2,
              padding: '5px 10px',
              borderRadius: 8,
            }}
          >
            {lastSession.endedAgo}
          </span>

          {/* "Still fresh" chip with flame */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COPPER,
              backgroundColor: 'rgba(196,145,95,0.16)',
              border: `1px solid ${COPPER_BORDER}`,
              padding: '5px 10px',
              borderRadius: 8,
            }}
          >
            <FlameIcon />
            Still fresh
          </span>
        </div>

        {/* Bottom content */}
        <div>
          {/* Serif title */}
          <div
            style={{
              fontFamily: FONT_EDITORIAL,
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: PALE_YELLOW,
              textShadow: GLOW_SOFT,
            }}
          >
            Jiu Jitsu
          </div>

          {/* Meta line */}
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            {durationStr} &middot; {lastSession.focusLabel} &middot; ended {lastSession.endedAgo}
          </div>

          {/* Button row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            {/* Primary: Add notes */}
            <button
              type="button"
              onClick={onAddNotes}
              className="j2-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                height: 44,
                padding: '0 20px',
                borderRadius: 12,
                border: 'none',
                backgroundColor: ORANGE,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <PencilIcon />
              Add notes
            </button>

            {/* Secondary: Not now */}
            <button
              type="button"
              onClick={onDismiss}
              style={{
                height: 44,
                padding: '0 14px',
                borderRadius: 12,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.45)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
