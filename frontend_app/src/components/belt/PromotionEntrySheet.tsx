// PromotionEntrySheet — writing about the day you were promoted.
//
// A promotion is its own journal entry. Opened from the promotion row in
// the journal stream, it is prose and nothing else: no duration, no gi
// toggle, no prism. Getting your belt is an emotional moment, not a
// training log, and the class itself (if there was one) is a separate
// session entry that the backend links to the promotion automatically.
//
// The words save to belt_history.notes, which is what the stream row
// already reads — so writing here replaces "The black belt. Tied on." with
// the user's own sentence, the same way a session row shows its notes.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FlatBelt from './FlatBelt.tsx';
import { beltDisplayName, isBeltRank } from '../../lib/beltCloth.ts';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL, CARD_GLOW_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY } from '../../lib/theme.ts';
import type { BeltHistoryEntry } from '../../types/api.ts';

const MAX_CHARS = 2000;

interface Props {
  open: boolean;
  promotion: BeltHistoryEntry | null;
  academy?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (id: string, notes: string) => void;
}

export default function PromotionEntrySheet({ open, promotion, academy, saving, onClose, onSave }: Props) {
  const [text, setText] = useState('');
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Seed on open only, so typing is never clobbered by a parent re-render.
  const promotionRef = useRef(promotion);
  promotionRef.current = promotion;
  useEffect(() => {
    if (!open) return;
    setText(promotionRef.current?.notes ?? '');
    const t = setTimeout(() => areaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  if (!open || !promotion) return null;

  const rank = isBeltRank(promotion.belt_rank) ? promotion.belt_rank : 'white';
  const name = beltDisplayName(rank, promotion.stripes);
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(promotion.promoted_at.slice(0, 10) + 'T00:00:00'));

  return createPortal(
    <div
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
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
        aria-label={`${name} — write about the day`}
        className="animate-j2-modal-in"
        style={{
          width: 600, maxWidth: '100%',
          background: '#17291F',
          border: `1px solid ${CARD_GLOW_BORDER}`,
          borderRadius: 22,
          padding: '34px 38px 30px',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: COPPER }}>
          A promotion
        </div>
        <h1
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 30, fontWeight: 600,
            color: PALE_YELLOW, margin: '8px 0 0', lineHeight: 1.15,
          }}
        >
          {name}
        </h1>
        <div style={{ fontSize: 12.5, color: TEXT_TERTIARY, marginTop: 8 }}>
          {dateLabel}{academy ? ` · ${academy}` : ''}
        </div>

        <div style={{ marginTop: 22, maxWidth: 380 }}>
          <FlatBelt rank={rank} stripes={promotion.stripes} />
        </div>

        {/* The writing — the whole point of this sheet. */}
        <textarea
          ref={areaRef}
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Who tied it on. What they said. What it took to get here…"
          rows={9}
          style={{
            width: '100%', marginTop: 24,
            background: 'transparent', border: 'none', outline: 'none', resize: 'vertical',
            fontFamily: FONT_EDITORIAL, fontSize: 17.5, lineHeight: 1.7,
            color: TEXT_PRIMARY, padding: 0, minHeight: 180,
          }}
        />

        <div style={{ fontSize: 11.5, color: TEXT_TERTIARY, marginTop: 6 }}>
          Just the day itself. Training details belong on the session entry.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, height: 46, borderRadius: 13,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'none', color: TEXT_SECONDARY,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(promotion.id, text.trim())}
            disabled={saving}
            style={{
              flex: 1, height: 46, borderRadius: 13,
              background: COPPER, color: '#12130e', border: 'none',
              fontSize: 14, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
