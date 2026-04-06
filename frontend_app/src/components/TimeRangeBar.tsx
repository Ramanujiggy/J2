import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, CalendarDays, X } from 'lucide-react';
import type { TimeWindow } from './SkillRadar.tsx';
import { CARD_BG, COPPER_BORDER, PALE_YELLOW, COPPER } from '../lib/theme.ts';
import { MONTH_NAMES } from '../lib/constants.ts';

interface TimeRangeBarProps {
  value: TimeWindow;
  onChange: (w: TimeWindow) => void;
  customRange: { start: string; end: string } | null;
  onCustomRange: (r: { start: string; end: string } | null) => void;
}

const PRIMARY: { id: TimeWindow; label: string }[] = [
  { id: '7d',  label: '7D'  },
  { id: '14d', label: '2W'  },
  { id: '30d', label: '30D' },
];

const SECONDARY: { id: TimeWindow; label: string }[] = [
  { id: '90d',  label: '3M' },
  { id: '180d', label: '6M' },
  { id: '1y',   label: '1Y' },
];

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export default function TimeRangeBar({ value, onChange, customRange, onCustomRange }: TimeRangeBarProps) {
  const [expanded, setExpanded]     = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd]     = useState('');

  const pill  = 'px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation';
  const active   = { backgroundColor: COPPER,      color: '#fff' };
  const inactive = { backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' };

  function selectPreset(w: TimeWindow) {
    onChange(w);
    onCustomRange(null);
    // auto-collapse secondary tier when any pill is chosen
    setExpanded(false);
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
      {/* ── Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 w-full">

        {/* Primary tier */}
        {PRIMARY.map(({ id, label }) => (
          <button
            key={id}
            className={pill}
            style={value === id ? active : inactive}
            onClick={() => selectPreset(id)}
          >
            {label}
          </button>
        ))}

        {/* Secondary tier — slides in / out */}
        <div
          className="flex gap-1.5"
          style={{
            overflow: 'hidden',
            maxWidth: expanded ? '160px' : '0px',
            opacity:  expanded ? 1 : 0,
            transition: 'max-width 260ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease',
            pointerEvents: expanded ? 'auto' : 'none',
          }}
        >
          {SECONDARY.map(({ id, label }) => (
            <button
              key={id}
              className={pill}
              style={value === id ? active : inactive}
              onClick={() => selectPreset(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Expand / collapse chevron */}
        <button
          className={`${pill} flex items-center justify-center`}
          style={inactive}
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Collapse time options' : 'Expand time options'}
        >
          {expanded
            ? <ChevronLeft size={13} strokeWidth={2.5} />
            : <ChevronRight size={13} strokeWidth={2.5} />}
        </button>

        {/* Calendar / custom range button — ml-auto pushes it to right */}
        {isCustomActive ? (
          <button
            className={`${pill} flex items-center gap-1 ml-auto`}
            style={{ ...active, paddingLeft: '8px', paddingRight: '6px' }}
            onClick={openPicker}
          >
            <span>{fmtDate(customRange!.start)} – {fmtDate(customRange!.end)}</span>
            <span
              role="button"
              aria-label="Clear custom range"
              onClick={e => { e.stopPropagation(); onChange('30d'); onCustomRange(null); }}
              className="ml-0.5 rounded hover:opacity-70 transition-opacity"
            >
              <X size={11} strokeWidth={2.5} />
            </span>
          </button>
        ) : (
          <button
            className={`${pill} flex items-center justify-center ml-auto`}
            style={inactive}
            onClick={openPicker}
            aria-label="Pick custom date range"
          >
            <CalendarDays size={13} strokeWidth={2} />
          </button>
        )}
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
              left: '50%',
              transform: 'translateX(-50%)',
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
                  className="w-full rounded-lg px-3 py-2 text-sm text-white/90 outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    border: `1px solid ${COPPER_BORDER}`,
                    colorScheme: 'dark',
                    // @ts-ignore
                    '--webkit-calendar-picker-indicator-filter': 'invert(1)',
                  }}
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
                  className="w-full rounded-lg px-3 py-2 text-sm text-white/90 outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    border: `1px solid ${COPPER_BORDER}`,
                    colorScheme: 'dark',
                  }}
                />
              </label>
            </div>

            {draftStart && draftEnd && draftStart > draftEnd && (
              <p className="text-xs text-red-400 mt-2">End must be after start.</p>
            )}

            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => setPickerOpen(false)}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCustom}
                disabled={!draftStart || !draftEnd || draftStart > draftEnd}
                className="px-4 py-2 rounded-full text-xs font-semibold transition-opacity disabled:opacity-40"
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
