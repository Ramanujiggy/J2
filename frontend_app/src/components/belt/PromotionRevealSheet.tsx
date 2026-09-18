// PromotionRevealSheet — the ceremony after "Tie it on".
//
// The sibling of SealRevealSheet: editing happens in PromotionSheet, the
// celebration happens here. A bottom sheet slides up over a scrim, names
// the promotion, and the belt ties itself on at full width — the same
// BeltBar that used to play in the nav rail, scaled up so it fills the
// stage instead of sitting 14px tall inside a 600px modal. It stays until
// dismissed (grab-handle drag, scrim tap, Escape, or the button) so the
// moment is the user's to end.
//
// Reduced motion: the tied belt is shown flat, no ceremony.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BeltBar, { BELT_BAR_HEIGHT } from '../BeltBar.tsx';
import FlatBelt from './FlatBelt.tsx';
import { beltDisplayName, type BeltRankKey } from '../../lib/beltCloth.ts';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';
import { vibrate } from '../../lib/haptics.ts';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL, CARD_GLOW_BORDER } from '../../lib/theme.ts';

const REDUCED = typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How much bigger than the rail belt the ceremony plays. */
const SCALE = 3;
/** Sheet max width minus its horizontal padding — the belt's stage. */
const SHEET_W = 520;
const SHEET_PAD = 26;
const STAGE_W = SHEET_W - SHEET_PAD * 2;

/** The rail belt's tails land ~1.2s in (slide + tail drop). */
const KNOT_HAPTIC_MS = 1200;

export interface PromotionRevealProps {
  open: boolean;
  rank: BeltRankKey;
  stripes: number;
  /** ISO date (YYYY-MM-DD) the promotion was recorded. */
  promotedAt: string | null;
  academy?: string | null;
  onClose: () => void;
}

export default function PromotionRevealSheet({
  open, rank, stripes, promotedAt, academy, onClose,
}: PromotionRevealProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  // Haptic when the knot lands, not on the tap.
  useEffect(() => {
    if (!open || REDUCED) return;
    const t = setTimeout(() => vibrate(10), KNOT_HAPTIC_MS);
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

  if (!open) return null;

  const name = beltDisplayName(rank, stripes);
  const dateLabel = promotedAt
    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        .format(new Date(promotedAt.slice(0, 10) + 'T00:00:00'))
    : null;
  const meta = [dateLabel ? `Tied on ${dateLabel}` : null, academy].filter(Boolean).join(' · ');

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
        aria-label={`${name} — ${meta}`}
        tabIndex={-1}
        className="fixed left-0 right-0 bottom-0 z-[71] animate-j2-sheet-up"
        style={{
          background: '#17291F',
          borderTop: `1px solid ${CARD_GLOW_BORDER}`,
          borderRadius: '26px 26px 0 0',
          padding: `14px ${SHEET_PAD}px 30px`,
          textAlign: 'center',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragStart.current == null ? 'transform 0.3s cubic-bezier(0.22,1,0.36,1)' : 'none',
          boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.7)',
          maxWidth: SHEET_W,
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

        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: COPPER }}>
          A promotion
        </div>

        {/* The stage. BeltBar is built in rail pixels, so it renders into a
            box 1/SCALE as wide and is transform-scaled up: the belt still
            spans the full stage, the knot and tails grow with it, and the
            tail easter egg keeps working. On narrow screens the stage
            shrinks with the sheet; the belt stays proportional. */}
        {REDUCED ? (
          <div style={{ marginTop: 26 }}>
            <FlatBelt rank={rank} stripes={stripes} size="sheet" />
          </div>
        ) : (
          <div
            aria-hidden
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: STAGE_W,
              margin: '26px auto 0',
              height: BELT_BAR_HEIGHT * SCALE,
              overflow: 'visible',
            }}
          >
            <div
              style={{
                position: 'absolute', top: 0, left: 0,
                width: `${100 / SCALE}%`,
                transform: `scale(${SCALE})`,
                transformOrigin: 'top left',
              }}
            >
              <BeltBar rank={rank} stripes={stripes} />
            </div>
          </div>
        )}

        <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 32, fontWeight: 600, color: PALE_YELLOW, marginTop: 22, letterSpacing: '-0.01em' }}>
          {name}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.44)', marginTop: 12 }}>
          {meta}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.62, color: 'rgba(255,255,255,0.66)', marginTop: 14, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
          It’s in your journal now, and it will come back on the anniversary.
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', height: 46, borderRadius: 13, marginTop: 22,
            fontSize: 14, fontWeight: 700, border: 'none',
            background: COPPER, color: '#12130e', cursor: 'pointer',
          }}
        >
          Oss
        </button>
      </div>
    </>,
    document.body,
  );
}
