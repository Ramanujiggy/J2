// PromotionSheet — recording a promotion.
//
// Opened by clicking the belt on Profile. You edit a draft: tape goes on
// and comes off the rank bar itself (each stripe is clickable to remove;
// one dashed ghost slot waits at the next position), and the cloth
// swatches change rank. Nothing is committed until "Tie it on".
//
// The ceremony itself lives in PromotionRevealSheet: on commit this sheet
// closes and the parent opens the reveal, where the belt ties on at full
// width. Editing and celebrating are different moments.
//
// Committing writes a belt_history row, which is what puts the promotion
// into the journal stream — see lib/journalStream.ts. That is the point of
// the flow: the promotion becomes part of the corpus and comes back on its
// anniversary through the ordinary memory chain.
//
// Promotions are records, never a Plus feature. This flow is never gated.

import { useEffect, useState } from 'react';
import FlatBelt, { stripeLeft, stripeWidth } from './FlatBelt.tsx';
import {
  BELT_CLOTH, BELT_RANK_ORDER, beltDisplayName, type BeltRankKey,
} from '../../lib/beltCloth.ts';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL, CARD_BG, COPPER_BORDER, TEXT_SECONDARY, TEXT_TERTIARY } from '../../lib/theme.ts';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';

const HAIRLINE       = '1px solid rgba(255,255,255,0.06)';

const REDUCED = typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "Tap" on touch screens, "Click" with a mouse — the sheet is shared by
 *  the mobile profile form and the desktop identity page. */
const POINTER_VERB = typeof matchMedia !== 'undefined'
  && matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click';

interface Props {
  open: boolean;
  rank: BeltRankKey;
  stripes: number;
  /** Shown on the tied-on row; the promotion is dated today by default. */
  academy?: string | null;
  saving?: boolean;
  onClose: () => void;
  onCommit: (next: { rank: BeltRankKey; stripes: number; promotedAt: string }) => void;
}

export default function PromotionSheet({
  open, rank, stripes, academy, saving, onClose, onCommit,
}: Props) {
  const [draftRank, setDraftRank] = useState<BeltRankKey>(rank);
  const [draftStripes, setDraftStripes] = useState(stripes);
  /** Index of a stripe just added — plays the tape strike once. */
  const [freshStripe, setFreshStripe] = useState<number | null>(null);

  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);

  // Reseed the draft each time the sheet opens so a cancelled edit never
  // leaks into the next one.
  useEffect(() => {
    if (!open) return;
    setDraftRank(rank);
    setDraftStripes(stripes);
    setFreshStripe(null);
  }, [open, rank, stripes]);

  if (!open) return null;

  const changed = draftRank !== rank || draftStripes !== stripes;
  const name = beltDisplayName(draftRank, draftStripes);
  const today = new Date();
  const promotedAt = today.toISOString().slice(0, 10);
  const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(today);

  const setRank = (next: BeltRankKey) => {
    setDraftRank(next);
    // A new rank starts bare — stripes belong to the belt you're on.
    if (next !== rank) setDraftStripes(0);
    setFreshStripe(null);
  };

  const addStripe = () => {
    if (draftStripes >= 4) return;
    setDraftStripes(n => n + 1);
    setFreshStripe(draftStripes);
  };

  const commit = () => {
    if (!changed) { onClose(); return; }
    onCommit({ rank: draftRank, stripes: draftStripes, promotedAt });
  };

  return (
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
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Record a promotion"
        className="animate-j2-modal-in"
        style={{
          width: '100%', maxWidth: '42rem',
          background: CARD_BG,
          border: `1px solid ${COPPER_BORDER}`,
          borderRadius: 16,
          padding: 24,
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: COPPER }}>
          A promotion
        </div>
        <div
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 30, fontWeight: 600,
            color: PALE_YELLOW, marginTop: 8,
          }}
        >
          {name}
        </div>

        <div style={{ marginTop: 24 }}>
            <FlatBelt
              rank={draftRank}
              stripes={draftStripes}
              size="sheet"
              renderStripes={size => (
                <>
                  {Array.from({ length: draftStripes }, (_, i) => (
                    <span
                      key={i}
                      role="button"
                      tabIndex={0}
                      title="Remove"
                      onClick={() => { setDraftStripes(n => Math.max(0, n - 1)); setFreshStripe(null); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDraftStripes(n => Math.max(0, n - 1)); } }}
                      className={freshStripe === i && !REDUCED ? 'animate-j2-tape' : undefined}
                      style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: stripeLeft(size, i), width: stripeWidth(size),
                        background: 'rgba(255,255,255,0.88)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                  {draftStripes < 4 && (
                    <span
                      role="button"
                      tabIndex={0}
                      title="Add tape"
                      onClick={addStripe}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addStripe(); } }}
                      className="j2-tape-slot"
                      style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: stripeLeft(size, draftStripes), width: stripeWidth(size),
                        border: '1px dashed rgba(255,255,255,0.35)',
                        cursor: 'pointer',
                      }}
                    />
                  )}
                </>
              )}
            />
        </div>

        <div style={{ fontSize: 11.5, color: TEXT_TERTIARY, marginTop: 10 }}>
          {POINTER_VERB} the bar to add tape{draftStripes < 4 ? ' — one slot waits.' : '.'}
        </div>

        {/* Cloth swatches */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          {BELT_RANK_ORDER.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setRank(k)}
              title={`${k[0]!.toUpperCase()}${k.slice(1)}`}
              aria-label={`${k[0]!.toUpperCase()}${k.slice(1)} belt`}
              aria-pressed={draftRank === k}
              disabled={saving}
              style={{
                flex: 1, height: 30, borderRadius: 6,
                background: BELT_CLOTH[k],
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: draftRank === k ? `0 0 0 2px ${COPPER}` : 'none',
                cursor: saving ? 'default' : 'pointer',
              }}
            />
          ))}
        </div>

        {/* Tied on */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginTop: 24, paddingTop: 18, borderTop: HAIRLINE, gap: 16,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
            Tied on
          </span>
          <span style={{ fontFamily: FONT_EDITORIAL, fontSize: 19, color: TEXT_SECONDARY, textAlign: 'right' }}>
            {dateLabel}{academy ? ` · ${academy}` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, height: 46, borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'none', color: TEXT_SECONDARY,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Not today
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            style={{
              flex: 1, height: 46, borderRadius: 10,
              background: COPPER, color: '#12130e', border: 'none',
              fontSize: 14, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Tying it on…' : 'Tie it on'}
          </button>
        </div>
      </div>
    </div>
  );
}
