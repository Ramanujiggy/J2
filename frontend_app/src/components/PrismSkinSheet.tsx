// PrismSkinSheet — "Prism style" on desktop, as a sheet.
//
// The identity screen's rule: click a row, a sheet opens, make the change.
// The toggle with its live preview is tall, so it lives here rather than
// inline in housekeeping where opening it would shove Your data and
// Account down the page. The choice saves as you click (localStorage), so
// the only button is Done.

import PrismSkinToggle from './PrismSkinToggle.tsx';
import type { PrismSkin } from './PrismFocusInput.tsx';
import { useFocusTrap } from '../hooks/useFocusTrap.ts';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL, TEXT_TERTIARY } from '../lib/theme.ts';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fires on every pick so the housekeeping row can show the current style. */
  onChange?: (skin: PrismSkin) => void;
}

export default function PrismSkinSheet({ open, onClose, onChange }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="animate-j2-backdrop-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(5,10,7,0.74)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Prism style"
        className="animate-j2-modal-in"
        style={{
          width: 460, maxWidth: '100%',
          background: '#17291F',
          border: '1px solid rgba(196,145,95,0.24)',
          borderRadius: 22,
          padding: '34px 38px 30px',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: COPPER }}>
          Appearance
        </div>
        <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 30, fontWeight: 600, color: PALE_YELLOW, marginTop: 8 }}>
          Prism style
        </div>
        <p style={{ fontSize: 13, color: TEXT_TERTIARY, marginTop: 6, marginBottom: 22, lineHeight: 1.5 }}>
          How the focus prism looks when you log a session. Drag the preview to feel it.
        </p>

        <PrismSkinToggle hideHeading onChange={onChange} />

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', height: 46, borderRadius: 13, marginTop: 26,
            background: COPPER, color: '#12130e', border: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
