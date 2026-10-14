// Coachmark — one-time dismissible spotlight modal. Patterned on Moonly
// (Refero `31b1c0e2-…`): serif heading + small copper glyph + body copy
// + single "Got it" pill. Editorial restraint, not a guided tour.
//
// Show/dismiss state lives in `useCoachmark(key)`. This component is
// presentational — render it conditionally on `isOpen` and pass `onDismiss`.

import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER,
  PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';

interface Props {
  open: boolean;
  onDismiss: () => void;
  /** Small label above the heading — e.g. "◇ Calendar" */
  eyebrow?: string;
  title: string;
  body: string;
  /** Optional small icon shown above the eyebrow. Defaults to a copper diamond glyph. */
  icon?: React.ReactNode;
  ctaLabel?: string;
}

export default function Coachmark({
  open,
  onDismiss,
  eyebrow,
  title,
  body,
  icon,
  ctaLabel = 'Got it',
}: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.62)',
        padding: 24,
        animation: 'j2-coachmark-fade 220ms ease both',
      }}
    >
      <style>{`
        @keyframes j2-coachmark-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: CARD_BG,
          border: `1px solid ${CARD_GLOW_BORDER}`,
          boxShadow: CARD_GLOW,
          borderRadius: 16,
          width: '100%',
          maxWidth: 420,
          padding: '28px 24px 22px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {icon ?? (
            <span
              aria-hidden
              style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                background: COPPER,
                transform: 'rotate(45deg)',
                boxShadow: `0 0 8px ${COPPER}88`,
              }}
            />
          )}
          {eyebrow && (
            <span
              style={{
                fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: COPPER,
              }}
            >
              {eyebrow}
            </span>
          )}
        </div>
        <h2
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 24, lineHeight: 1.25,
            color: PALE_YELLOW, textShadow: GLOW_SOFT, marginBottom: 12,
          }}
        >
          {title}
        </h2>
        <p style={{ color: 'rgba(242,228,168,0.72)', fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
          {body}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            style={{
              backgroundColor: COPPER,
              color: '#fff',
              fontSize: 14, fontWeight: 600,
              padding: '10px 18px', borderRadius: 12,
              border: `1px solid ${COPPER_BORDER}`,
              cursor: 'pointer',
            }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
