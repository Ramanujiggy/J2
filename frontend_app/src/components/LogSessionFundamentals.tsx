// LogSessionFundamentals — Section 1 of LogSessionForm.
//
// The four "what kind of training was this" controls:
//   • Gi / No-Gi / Both (mig 025 added 'both')
//   • Session Type (Class / Free Drilling / CLA — `competition_training` is
//     legacy-readable but never offered as a new selection; see SESSION_TYPES)
//   • Duration stepper (30-min increments, 30..240 min, default 60)
//   • Intensity stepper (1..5, BJJ-themed labels)
//
// Pure presentation — all state lives in the parent LogSessionForm.
// Extracted from LogSessionForm.tsx during the 2026-05-08 refactor.

import { vibrate } from '../lib/haptics.ts';
import { INTENSITY_COLOR } from '../lib/sessionUtils.ts';
import { SURFACE_2, SURFACE_3, PALE_YELLOW, INT_LABELS } from '../lib/theme.ts';
import SegmentedToggle from './SegmentedToggle.tsx';

export type GiNoGi = 'gi' | 'no_gi' | 'both';
// `competition_training` is preserved as a valid value for legacy data; new
// sessions use `class | drilling | cla`. The form picker only surfaces the new
// three-way taxonomy. CLA = Constraints-Led Approach.
export type SessionType = 'drilling' | 'class' | 'competition_training' | 'cla';

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'class',    label: 'Class' },
  { value: 'drilling', label: 'Free Drilling' },
  { value: 'cla',      label: 'CLA' },
];

// Intensity labels come from the canonical INT_LABELS ladder in theme.ts
// (1-indexed: Drill / Light / Steady / Intense / Hard roll). Drill = no
// resistance; Light = relaxed flow; Steady = honest pace; Intense =
// tournament-prep round; Hard roll = full send.

const DUR_STEP = 30;
const DUR_MIN  = 30;
const DUR_MAX  = 240;

function fmtDuration(m: number) {
  const h   = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 && min > 0 ? `${h} h  ${min} m`
       : h > 0             ? `${h} h`
       :                     `${min} m`;
}

interface FundamentalsProps {
  giNogi: GiNoGi;
  onGiNogiChange: (v: GiNoGi) => void;
  sessionType: SessionType;
  onSessionTypeChange: (v: SessionType) => void;
  durationMinutes: number;
  onDurationChange: (m: number) => void;
  intensity: number;
  onIntensityChange: (i: number) => void;
}

export default function LogSessionFundamentals({
  giNogi,
  onGiNogiChange,
  sessionType,
  onSessionTypeChange,
  durationMinutes,
  onDurationChange,
  intensity,
  onIntensityChange,
}: FundamentalsProps) {
  return (
    <>
      <div className="j2-label-copper">Fundamentals</div>

      {/* Gi / No-Gi / Both — 'both' (mig 025) for sessions that mixed
          gi and no-gi work in one block (e.g. gi for warmup + drilling,
          no-gi for live rolls). Analytics weight 'both' as 0.5/0.5. */}
      <SegmentedToggle
        options={[
          { value: 'gi'    as GiNoGi, label: 'Gi'    },
          { value: 'no_gi' as GiNoGi, label: 'No-Gi' },
          { value: 'both'  as GiNoGi, label: 'Both'  },
        ]}
        value={giNogi}
        onChange={v => v && onGiNogiChange(v)}
      />

      {/* Session Type */}
      <SegmentedToggle
        options={SESSION_TYPES}
        value={sessionType}
        onChange={v => v && onSessionTypeChange(v)}
      />

      {/* Duration + Intensity — side-by-side steppers. Both share the
          same SURFACE_3 stepper shell so they read as a paired control.
          Saves ~80pt of vertical real estate vs the old stacked
          5-bar gradient. Intensity value tints in the level's color. */}
      <div className="grid grid-cols-2 gap-3">
        {/* Duration */}
        <div>
          <p className="text-[10px] mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)', letterSpacing: '0.14em' }}>
            Duration
          </p>
          <div
            className="flex items-center justify-center gap-1 rounded-xl py-2"
            style={{ backgroundColor: SURFACE_3 }}
          >
            <button
              type="button"
              onClick={() => { vibrate(8); onDurationChange(Math.max(DUR_MIN, durationMinutes - DUR_STEP)); }}
              className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
              style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
              disabled={durationMinutes <= DUR_MIN}
              aria-label="Decrease duration"
            >
              −
            </button>
            <span
              className="font-bold flex-1 text-center"
              style={{ color: PALE_YELLOW, fontSize: 17 }}
            >
              {fmtDuration(durationMinutes)}
            </span>
            <button
              type="button"
              onClick={() => { vibrate(8); onDurationChange(Math.min(DUR_MAX, durationMinutes + DUR_STEP)); }}
              className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
              style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
              disabled={durationMinutes >= DUR_MAX}
              aria-label="Increase duration"
            >
              +
            </button>
          </div>
        </div>

        {/* Intensity */}
        <div>
          <p className="text-[10px] mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)', letterSpacing: '0.14em' }}>
            Intensity
          </p>
          <div
            className="flex items-center justify-center gap-1 rounded-xl py-2"
            style={{ backgroundColor: SURFACE_3 }}
          >
            <button
              type="button"
              onClick={() => { vibrate(8); onIntensityChange(Math.max(1, intensity - 1)); }}
              className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
              style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
              disabled={intensity <= 1}
              aria-label="Decrease intensity"
            >
              −
            </button>
            <span
              className="font-bold flex-1 text-center"
              style={{
                color: INTENSITY_COLOR[intensity] ?? PALE_YELLOW,
                fontSize: 14,
                letterSpacing: '0.02em',
                textShadow: `0 0 12px ${INTENSITY_COLOR[intensity] ?? '#A8CB72'}40`,
              }}
            >
              {INT_LABELS[intensity]}
            </span>
            <button
              type="button"
              onClick={() => { vibrate(8); onIntensityChange(Math.min(5, intensity + 1)); }}
              className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
              style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
              disabled={intensity >= 5}
              aria-label="Increase intensity"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
