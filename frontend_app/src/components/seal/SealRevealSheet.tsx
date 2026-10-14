// SealRevealSheet — the certificate that opens when a die is struck or tapped.
//
// Not a zoom viewer: it names what you did. The die re-strikes at 172px on open
// (j2-seal-land) so it feels like the moment happening again. Bottom sheet with
// scrim, grab-handle drag-down + backdrop-tap dismiss, modal-dialog a11y.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import SealStamp from './SealStamp.tsx';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';
import { vibrate } from '../../lib/haptics.ts';
import { bandDate, struckMeta, type StampDie } from '../../lib/stampDies.ts';
import { PALE_YELLOW, FONT_EDITORIAL, CARD_GLOW_BORDER, TEXT_SECONDARY, TEXT_TERTIARY } from '../../lib/theme.ts';

interface Props {
  open: boolean;
  die: StampDie | null;
  /** ISO timestamp of the strike being celebrated. */
  struckAt: string | null;
  count: number;
  autoEarned: boolean;
  onClose: () => void;
}

export default function SealRevealSheet({ open, die, struckAt, count, autoEarned, onClose }: Props) {
  const navigate = useNavigate();
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const landedRef = useRef(false);

  // Haptic on the die's land frame (not the tap) — fire once ~when the
  // j2-seal-land animation settles.
  useEffect(() => {
    if (!open) { landedRef.current = false; return; }
    landedRef.current = false;
    const t = setTimeout(() => {
      if (!landedRef.current) { landedRef.current = true; vibrate(10); }
    }, 320);
    return () => clearTimeout(t);
  }, [open]);

  const onGrabDown = useCallback((e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onGrabMove = useCallback((e: React.PointerEvent) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  }, []);
  const onGrabUp = useCallback(() => {
    if (dragStart.current == null) return;
    const shouldClose = dragY > 90;
    dragStart.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  }, [dragY, onClose]);

  if (!open || !die || !struckAt) return null;

  const meta = struckMeta(struckAt, count, autoEarned);

  return createPortal(
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[70]"
        style={{
          background: 'rgba(5,10,7,0.74)',
          backdropFilter: 'blur(2px)',
          animation: 'j2-backdrop-in 0.34s ease both',
        }}
      />
      {/* Sheet */}
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${die.name} — ${meta}`}
        tabIndex={-1}
        className="fixed left-0 right-0 bottom-0 z-[71] animate-j2-sheet-up"
        style={{
          background: '#17291F',
          borderTop: `1px solid ${CARD_GLOW_BORDER}`,
          borderRadius: '16px 16px 0 0',
          padding: '14px 26px 30px',
          textAlign: 'center',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragStart.current == null ? 'transform 0.3s cubic-bezier(0.22,1,0.36,1)' : 'none',
          boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.7)',
          maxWidth: 520,
          margin: '0 auto',
        }}
      >
        {/* Grab handle — drag down to dismiss */}
        <div
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          style={{ padding: '4px 0 18px', cursor: 'grab', touchAction: 'none' }}
        >
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.16)', margin: '0 auto' }} />
        </div>

        {/* The die re-strikes at full size on open */}
        <SealStamp
          die={die}
          top={bandDate(struckAt)}
          size={172}
          className="animate-j2-seal-land"
          style={{ margin: '0 auto' }}
        />

        <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 32, fontWeight: 600, color: PALE_YELLOW, marginTop: 20, letterSpacing: '-0.01em' }}>
          {die.name}
        </div>
        <div
          style={{ fontSize: 14, lineHeight: 1.62, color: TEXT_SECONDARY, marginTop: 8, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}
          dangerouslySetInnerHTML={{ __html: die.why }}
        />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: TEXT_TERTIARY, marginTop: 18 }}>
          {meta}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 46, borderRadius: 10, fontSize: 14, fontWeight: 700, border: '1px solid var(--j2-border-2)', background: 'none', color: TEXT_SECONDARY, cursor: 'pointer' }}
          >
            Share
          </button>
          <button
            onClick={() => { onClose(); navigate('/profile/collection'); }}
            style={{ flex: 1, height: 46, borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', background: '#C4915F', color: '#12130e', cursor: 'pointer' }}
          >
            Collection
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
