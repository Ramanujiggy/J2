// LogSessionMobileHeader — the mobile-only editorial header at the top of
// the LogSessionForm. Replaces the full-bleed BeltDateBanner that ships on
// desktop. Top-to-bottom:
//   1. 4pt belt-color hairline (full-bleed, ambient brand thread)
//   2. Copper eyebrow date (TUE · APR 27) — tappable, opens date picker
//   3. Cormorant Garamond italic title — "Today's session" / "Yesterday's
//      session" / long-form date
//
// Total vertical cost ~80pt, vs ~150pt for the full belt-banner. The banner
// stays on the home and session-detail surfaces where it has narrative
// weight; here on the compose form it was costing real estate without
// earning the editorial register the desktop has achieved.
//
// Extracted from LogSessionForm.tsx during the 2026-05-08 page-file refactor
// pass. No behavioural changes vs the inline version it replaced.

import { useRef } from 'react';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL } from '../lib/theme.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { BELT_COLORS, type BeltRank } from '../lib/belt.ts';

function beltHairlineColor(rank: BeltRank): string {
  // White and blue belts use their own color — light enough to read against forest.
  // Purple/brown/black fall back to COPPER so the strip stays warm against the
  // dark canvas (a black hairline on near-black would be invisible).
  if (rank === 'white' || rank === 'blue') return BELT_COLORS[rank];
  return COPPER;
}

function todayLocalString(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function yesterdayLocalString(): string {
  const t = new Date(Date.now() - 86_400_000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function formatEyebrowDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const wkday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${wkday} · ${month} ${d.getDate()}`.toUpperCase();
}

function formatTitleForDate(dateStr: string): string {
  if (dateStr === todayLocalString()) return "Today's session";
  if (dateStr === yesterdayLocalString()) return "Yesterday's session";
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

interface MobileHeaderProps {
  date: string;
  onChange: (d: string) => void;
}

export default function LogSessionMobileHeader({ date, onChange }: MobileHeaderProps) {
  const { beltRank } = useProfile();
  const rank: BeltRank = (beltRank as BeltRank) ?? 'white';
  const hairlineColor = beltHairlineColor(rank);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    // showPicker() is the modern API; fall back to click() for older browsers.
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* fall through */ }
    }
    el.click();
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* 4pt belt-color hairline — full-bleed at the top of the form */}
      <div
        aria-hidden
        style={{
          height: 4,
          background: hairlineColor,
          boxShadow: `0 0 12px ${hairlineColor}40`,
        }}
      />

      <div style={{ padding: '20px 20px 0 20px' }}>
        {/* Date control — eyebrow + serif title are wrapped in a single
            full-width button so the whole block is one tap target. Visually
            still an editorial header (no border, no fill); hit area meets
            the 44pt iOS HIG minimum because the inner content stacks to
            ~52pt total height. The chevron sits next to the title so the
            larger, more visible element carries the "tappable" cue. */}
        <button
          type="button"
          onClick={openDatePicker}
          aria-label={`Session date: ${formatTitleForDate(date)}. Tap to change.`}
          className="touch-manipulation"
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 0',
            margin: 0,
            cursor: 'pointer',
            textAlign: 'left',
            display: 'block',
            width: '100%',
            color: 'inherit',
          }}
        >
          <div className="j2-label-copper">{formatEyebrowDate(date)}</div>
          <div
            style={{
              fontFamily: FONT_EDITORIAL,
              fontStyle: 'italic',
              fontSize: 24,
              lineHeight: 1.15,
              color: PALE_YELLOW,
              opacity: 0.9,
              marginTop: 8,
              letterSpacing: '-0.005em',
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
            }}
          >
            <span>{formatTitleForDate(date)}</span>
            <span
              aria-hidden
              style={{ fontSize: 14, opacity: 0.45, fontStyle: 'normal', fontFamily: 'inherit' }}
            >
              ▾
            </span>
          </div>
        </button>

        {/* Hidden native date input — anchors the picker. Sits visually
            inside the button area so iOS Safari opens the picker near the
            tap target, not at the page corner. */}
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={e => onChange(e.target.value)}
          aria-hidden
          tabIndex={-1}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: 1, height: 1,
            left: 20, top: 32,
          }}
        />
      </div>
    </div>
  );
}
