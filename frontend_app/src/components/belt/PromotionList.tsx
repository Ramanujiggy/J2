// PromotionList — the promotions a practitioner has recorded, newest first.
//
// Shared by the mobile profile form, the desktop "Your details" page and
// the desktop identity screen, so the ladder reads the same everywhere.
// Each row is a position (rank + stripes) with the month it was tied on.
//
// Remove is a two-tap affair on the row itself — "Remove" becomes "Sure?"
// for a few seconds — so a correction never needs a modal, and a stray tap
// never deletes anything.

import { useEffect, useState } from 'react';
import { beltDisplayName, isBeltRank } from '../../lib/beltCloth.ts';
import { FONT_EDITORIAL, TEXT_SECONDARY, TEXT_TERTIARY } from '../../lib/theme.ts';
import type { BeltHistoryEntry } from '../../types/api.ts';

const HAIRLINE = '1px solid rgba(255,255,255,0.06)';
const CONFIRM_WINDOW_MS = 3500;

/** "March 2026" — how a promotion is dated on the belt surfaces. */
export const formatPromotionMonth = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
    .format(new Date(iso.slice(0, 10) + 'T00:00:00'));

interface Props {
  entries: BeltHistoryEntry[];
  /** Absent → rows are read-only. */
  onRemove?: (id: string) => void;
  /** Which id is mid-delete, to dim its row. */
  removingId?: string | null;
  /** 'sheet' is the slightly larger type used on desktop. */
  size?: 'form' | 'sheet';
  style?: React.CSSProperties;
}

export default function PromotionList({ entries, onRemove, removingId, size = 'form', style }: Props) {
  const [armed, setArmed] = useState<string | null>(null);

  // Disarm on its own so "Sure?" never lingers.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), CONFIRM_WINDOW_MS);
    return () => clearTimeout(t);
  }, [armed]);

  if (entries.length === 0) return null;

  const nameSize = size === 'sheet' ? 18 : 17;

  return (
    <div style={style}>
      {entries.map(entry => {
        const isArmed = armed === entry.id;
        const busy = removingId === entry.id;
        return (
          <div
            key={entry.id}
            style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 16, padding: '10px 0', borderTop: HAIRLINE,
              opacity: busy ? 0.4 : 1, transition: 'opacity 0.2s',
            }}
          >
            <span style={{ fontFamily: FONT_EDITORIAL, fontSize: nameSize, color: TEXT_SECONDARY, flex: 1, minWidth: 0 }}>
              {beltDisplayName(isBeltRank(entry.belt_rank) ? entry.belt_rank : 'white', entry.stripes)}
            </span>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, whiteSpace: 'nowrap' }}>
              {formatPromotionMonth(entry.promoted_at)}
            </span>
            {onRemove && (
              <button
                type="button"
                disabled={busy}
                aria-label={isArmed ? 'Confirm remove' : `Remove ${beltDisplayName(isBeltRank(entry.belt_rank) ? entry.belt_rank : 'white', entry.stripes)}`}
                onClick={() => {
                  if (isArmed) { setArmed(null); onRemove(entry.id); }
                  else setArmed(entry.id);
                }}
                onBlur={() => { if (isArmed) setArmed(null); }}
                className="touch-manipulation"
                style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '4px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                  border: isArmed ? '1px solid rgba(224,117,96,0.5)' : '1px solid transparent',
                  background: isArmed ? 'rgba(224,117,96,0.12)' : 'none',
                  color: isArmed ? '#E07560' : 'rgba(255,255,255,0.30)',
                  cursor: busy ? 'default' : 'pointer',
                  transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                }}
              >
                {isArmed ? 'Sure?' : 'Remove'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
