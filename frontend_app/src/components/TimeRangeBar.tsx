import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, X } from 'lucide-react';
import type { TimeWindow } from '../lib/analyticsUtils.ts';
import { CARD_BG, COPPER_BORDER, PALE_YELLOW, COPPER, SURFACE_3, DATE_INPUT_STYLE } from '../lib/theme.ts';
import { MONTH_NAMES } from '../lib/constants.ts';

interface TimeRangeBarProps {
  value: TimeWindow;
  onChange: (w: TimeWindow) => void;
  customRange: { start: string; end: string } | null;
  onCustomRange: (r: { start: string; end: string } | null) => void;
}

// All presets visible at once. The previous v2 design split this into a
// primary tier (7D/2W/30D) and a chevron-toggled secondary tier (3M/6M/1Y/All)
// — the secondary auto-closed on every selection, which made "switch from 30D
// to 1Y" cost 3 clicks. Single row is the Linear / Vercel / Stripe pattern.
const PRESETS: { id: TimeWindow; label: string }[] = [
  { id: '7d',   label: '7D'  },
  { id: '14d',  label: '2W'  },
  { id: '30d',  label: '30D' },
  { id: '90d',  label: '3M'  },
  { id: '180d', label: '6M'  },
  { id: '1y',   label: '1Y'  },
  { id: 'all',  label: 'All' },
];

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export default function TimeRangeBar({ value, onChange, customRange, onCustomRange }: TimeRangeBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd]     = useState('');

  const scrollRef     = useRef<HTMLDivElement>(null);
  const activeBtnRef  = useRef<HTMLButtonElement>(null);

  // On viewports too narrow for all 7 presets + custom button to fit, the
  // row scrolls horizontally. Keep the active pill centered into view so the
  // user can always see what's selected without manual scrolling.
  useEffect(() => {
    const btn = activeBtnRef.current;
    if (!btn) return;
    btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [value]);

  const pill  = 'px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation j2-press min-h-[44px] flex items-center justify-center whitespace-nowrap';
  const active   = { backgroundColor: COPPER,      color: '#fff' };
  const inactive = { backgroundColor: SURFACE_3, color: 'rgba(255,255,255,0.55)' };

  function selectPreset(w: TimeWindow) {
    onChange(w);
    onCustomRange(null);
  }

  function openPicker() {
    setDraftStart(customRange?.start ?? '');
    setDraftEnd(customRange?.end   ?? '');
    setPickerOpen(true);
  }

  function applyCustom() {
    if (!draftStart || !draftEnd || draftStart > draftEnd) return;
    onChange('custom');
    onCustomRange({ start: draftStart, end: draftEnd });
    setPickerOpen(false);
  }

  const isCustomActive = value === 'custom' && customRange != null;

  return (
    <>
      {/* ── Bar ────────────────────────────────────────────────────────
          Single horizontal row, all presets always visible. Pill row
          horizontal-scrolls on narrow viewports (active pill auto-scrolls
          into view); the custom-range button sits inline at the right end
          of the scroll container so it remains accessible. */}
      <div className="flex items-center gap-2 w-full">
        <div
          ref={scrollRef}
          className="j2-time-range-scroll flex items-center gap-2 flex-1 min-w-0"
          style={{
            overflowX: 'auto',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <style>{`.j2-time-range-scroll::-webkit-scrollbar { display: none; }`}</style>

          {PRESETS.map(({ id, label }) => {
            const isActive = value === id;
            return (
              <button
                key={id}
                ref={isActive ? activeBtnRef : undefined}
                className={pill}
                style={isActive ? active : inactive}
                onClick={() => selectPreset(id)}
              >
                {label}
              </button>
            );
          })}

          {/* Custom range trigger — inline at the right end of the scroll
              container. Renders the active range when one is set. */}
          {isCustomActive ? (
            <button
              ref={activeBtnRef}
              className={`${pill} flex items-center gap-1`}
              style={{ ...active, paddingLeft: '10px', paddingRight: '8px' }}
              onClick={openPicker}
            >
              <span>{fmtDate(customRange!.start)} – {fmtDate(customRange!.end)}</span>
              <span
                role="button"
                aria-label="Clear custom range"
                onClick={e => { e.stopPropagation(); onChange('30d'); onCustomRange(null); }}
                className="ml-0.5 rounded hover:opacity-70 transition-opacity"
              >
                <X size={14} strokeWidth={2.5} />
              </span>
            </button>
          ) : (
            <button
              className={`${pill} flex items-center justify-center`}
              style={inactive}
              onClick={openPicker}
              aria-label="Pick custom date range"
            >
              <CalendarDays size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ── Date picker modal (portalled to body to escape ancestor transforms) ── */}
      {pickerOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', animation: 'j2-backdrop-in 250ms ease both' }}
            onClick={() => setPickerOpen(false)}
          />

          {/* Dialog */}
          <div
            className="fixed z-50 rounded-2xl p-5 shadow-xl"
            style={{
              top: 'clamp(15%, 20vh, 30%)',
              left: 0,
              right: 0,
              marginLeft: 'auto',
              marginRight: 'auto',
              width: 'min(320px, calc(100vw - 32px))',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 4rem)',
              overflowY: 'auto',
              backgroundColor: CARD_BG,
              border: `1px solid ${COPPER_BORDER}`,
              animation: 'j2-modal-in 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: PALE_YELLOW }}>
              Custom Date Range
            </h3>

            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs text-white/50 mb-1">Start</span>
                <input
                  type="date"
                  value={draftStart}
                  max={draftEnd || undefined}
                  onChange={e => setDraftStart(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:ring-1"
                  style={DATE_INPUT_STYLE}
                />
              </label>

              <label className="block">
                <span className="block text-xs text-white/50 mb-1">End</span>
                <input
                  type="date"
                  value={draftEnd}
                  min={draftStart || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setDraftEnd(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:ring-1"
                  style={DATE_INPUT_STYLE}
                />
              </label>
            </div>

            {draftStart && draftEnd && draftStart > draftEnd && (
              <p className="text-xs text-error mt-2">End must be after start.</p>
            )}

            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => setPickerOpen(false)}
                className="px-4 py-2.5 rounded-lg text-xs text-white/50 transition-colors touch-manipulation j2-press"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
              >
                Cancel
              </button>
              <button
                onClick={applyCustom}
                disabled={!draftStart || !draftEnd || draftStart > draftEnd}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-opacity disabled:opacity-40 min-h-[40px] touch-manipulation j2-press"
                style={{ backgroundColor: COPPER, color: '#fff' }}
              >
                Apply
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
