// FilmingGuide — how to film a roll so the footage is worth reviewing.
//
// Shown the first time someone attaches session footage (then on demand from
// the "How to film a roll" link under the upload button). The same framing is
// what later lets the app follow the two people in the roll: one pair, side
// on, steady, whole bodies in frame.
//
// §4 modal box (sm, 28rem). Portal at z-index 60 so it sits above the session
// detail modal it is opened from.

import { createPortal } from 'react-dom';
import {
  BRAND_ORANGE, CARD_BG, COPPER, COPPER_BORDER, FONT_EDITORIAL, GLOW_SOFT,
  PALE_YELLOW, TEXT_BODY, TEXT_TERTIARY, SURFACE_2_BORDER,
} from '../lib/theme.ts';

export const FILMING_GUIDE_SEEN_KEY = 'j2_filming_guide_seen';

export function hasSeenFilmingGuide(): boolean {
  try { return window.localStorage.getItem(FILMING_GUIDE_SEEN_KEY) === '1'; } catch { return true; }
}

export function markFilmingGuideSeen(): void {
  try { window.localStorage.setItem(FILMING_GUIDE_SEEN_KEY, '1'); } catch { /* ignore */ }
}

export const FILMING_TIPS: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Keep it still', body: 'Prop the phone against a bag or use a small tripod. Handheld footage is hard to watch back.' },
  { title: 'Side on, at waist height', body: 'Level with the mat, looking across it. From above or end on, bodies hide each other.' },
  { title: 'Three to five metres back', body: 'Close enough to fill the frame, far enough that a scramble stays in it. Keep both of you head to toe.' },
  { title: 'One pair', body: 'Frame your roll, not the room. Other pairs passing in front make it hard to follow yours.' },
  { title: 'Landscape, from the slap', body: 'Turn the phone sideways and start recording before you engage, so the grip fight is in it.' },
];

interface Props {
  /** Primary action label. "Choose footage" when opened from the upload button. */
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}

export default function FilmingGuide({ actionLabel, onAction, onClose }: Props) {
  return createPortal(
    <div
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="animate-j2-backdrop-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(13,26,20,0.85)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto',
        paddingLeft: '1rem', paddingRight: '1rem',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filming-guide-title"
        data-no-page-swipe=""
        className="animate-j2-modal-in"
        style={{
          width: '100%', maxWidth: '28rem',
          background: CARD_BG,
          border: `1px solid ${COPPER_BORDER}`,
          borderRadius: 16,
          padding: 24,
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
      >
        <div className="j2-label-copper" style={{ marginBottom: 10 }}>Footage</div>
        <h2
          id="filming-guide-title"
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 26, fontWeight: 500, lineHeight: 1.15,
            letterSpacing: '-0.01em', color: PALE_YELLOW, textShadow: GLOW_SOFT, margin: 0,
          }}
        >
          Filming a roll
        </h2>
        <p className="j2-serif-italic" style={{ fontSize: 16, margin: '8px 0 20px' }}>
          Set it up once, then forget the camera is there.
        </p>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {FILMING_TIPS.map((tip, i) => (
            <li
              key={tip.title}
              style={{
                display: 'flex', gap: 14, padding: '12px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${SURFACE_2_BORDER}`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: COPPER, minWidth: 14, lineHeight: '20px' }}>
                {i + 1}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_BODY, lineHeight: '20px' }}>{tip.title}</div>
                <div style={{ fontSize: 13, color: TEXT_TERTIARY, lineHeight: 1.55, marginTop: 2 }}>{tip.body}</div>
              </div>
            </li>
          ))}
        </ol>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            className="touch-manipulation"
            style={{
              flex: 1, minHeight: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'transparent', color: TEXT_TERTIARY, fontSize: 14, fontWeight: 600,
            }}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAction}
            className="touch-manipulation"
            style={{
              flex: 2, minHeight: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: BRAND_ORANGE, color: 'white', fontSize: 14, fontWeight: 600,
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
