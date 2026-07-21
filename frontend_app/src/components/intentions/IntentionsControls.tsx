// IntentionsControls — three desktop-only header controls for the
// IntentionsView:
//
//   • FilterBar           — focus chip row (All / Stand-up / Passing / etc)
//   • YearTabs            — year picker chip row, mirrors FilterBar styling
//   • DesktopLayoutToggle — Timeline ↔ Eras toggle (bespoke replacement for
//                           the generic SegmentedToggle; matches the 42px
//                           orange CTA height for visual rhythm)
//
// All three are exported individually so the desktop view file can compose
// them in the spots that fit. Pure presentation; state lives in the parent.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import { CalendarDays, Layers } from 'lucide-react';
import { COPPER, PALE_YELLOW, SURFACE_2 } from '../../lib/theme.ts';
import {
  ALL_PILLARS, FOCUS_COLORS, PILLAR_LABEL,
  type FocusFilter, type IntentionsLayout,
} from './intentionsTypes.ts';

// ── Filter chip bar ──────────────────────────────────────────────────────

export function FilterBar({ value, onChange }: { value: FocusFilter; onChange: (v: FocusFilter) => void }) {
  const chip = (label: string, isActive: boolean, onClick: () => void, dotColor?: string) => (
    <button
      key={label}
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      style={{
        height: 34,
        padding: '0 16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 17,
        backgroundColor: isActive ? 'rgba(196,145,95,0.16)' : SURFACE_2,
        border: `1px solid ${isActive ? COPPER : 'rgba(255,255,255,0.10)'}`,
        color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.65)',
        cursor: 'pointer',
        transition: 'all 160ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {dotColor && (
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}80`,
          }}
        />
      )}
      {label}
    </button>
  );

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 0 22px',
        marginBottom: 24,
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        flexWrap: 'wrap',
      }}
    >
      <div
        className="j2-label-micro"
        style={{ marginRight: 8, fontSize: 12, letterSpacing: '0.16em' }}
      >
        Filter
      </div>
      {chip('All', value === 'All', () => onChange('All'))}
      {ALL_PILLARS.map(p =>
        chip(PILLAR_LABEL[p], value === p, () => onChange(p), FOCUS_COLORS[p]),
      )}
    </div>
  );
}

// ── Year picker — chip row mirroring FilterBar styling ───────────────────

export function YearTabs({
  years,
  value,
  onChange,
}: {
  years: { year: string; count: number }[];
  value: string;
  onChange: (year: string) => void;
}) {
  if (years.length === 0) return null;
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingTop: 6,
        paddingBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      <div
        className="j2-label-micro"
        style={{ marginRight: 8, fontSize: 12, letterSpacing: '0.16em' }}
      >
        Year
      </div>
      {years.map(({ year, count }) => {
        const active = year === value;
        return (
          <button
            key={year}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(year)}
            style={{
              height: 36,
              padding: '0 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 18,
              backgroundColor: active ? 'rgba(196,145,95,0.16)' : SURFACE_2,
              border: `1px solid ${active ? COPPER : 'rgba(255,255,255,0.10)'}`,
              color: active ? PALE_YELLOW : 'rgba(255,255,255,0.75)',
              cursor: 'pointer',
              transition: 'all 160ms ease',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {year}
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: active ? COPPER : 'rgba(255,255,255,0.42)',
              }}
            >
              {count}w
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Desktop Timeline ↔ Eras toggle ───────────────────────────────────────
//
// Bespoke replacement for the generic SegmentedToggle in the desktop header.
// SegmentedToggle's compact pill felt thin against the 42px orange CTA next
// to it, and two-letter-different labels ("Timeline" / "Eras") made the
// sliding indicator look uneven. This version:
//   • matches the CTA's 42px height for visual rhythm
//   • adds lucide icons so the metaphor lands without reading the label
//   • uses copper border + champagne accent for the active half so it
//     reads as a sibling control to the orange CTA, not a faded afterthought

export function DesktopLayoutToggle({
  value,
  onChange,
}: {
  value: IntentionsLayout;
  onChange: (next: IntentionsLayout) => void;
}) {
  const opts: Array<{ key: IntentionsLayout; label: string; Icon: typeof CalendarDays }> = [
    { key: 'timeline', label: 'Timeline', Icon: CalendarDays },
    { key: 'eras',     label: 'Eras',     Icon: Layers },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        height: 42,
        padding: 4,
        background: SURFACE_2,
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        gap: 2,
      }}
    >
      {opts.map(({ key, label, Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            style={{
              height: '100%',
              padding: '0 18px',
              minWidth: 116,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.01em',
              borderRadius: 8,
              background: active ? 'rgba(196,145,95,0.18)' : 'transparent',
              border: active ? `1px solid ${COPPER}` : '1px solid transparent',
              color: active ? PALE_YELLOW : 'rgba(255,255,255,0.55)',
              boxShadow: active ? '0 0 0 1px rgba(196,145,95,0.10), 0 6px 18px -10px rgba(196,145,95,0.45)' : 'none',
              cursor: 'pointer',
              transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
            }}
          >
            <Icon size={15} strokeWidth={active ? 2 : 1.7} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
