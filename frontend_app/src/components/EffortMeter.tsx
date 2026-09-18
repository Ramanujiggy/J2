// EffortMeter — five ascending bars for session intensity (1–5). Tap a bar to
// set the level; the label + description update. Ported from the Margin Notes
// handoff's effort meter, but bound to the app's existing intensity scale
// (INT_LABELS / INT_COLORS) rather than a parallel palette.

import { INT_LABELS, INT_COLORS, FONT_EDITORIAL } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';

const DESCRIPTIONS: Record<number, string> = {
  1: 'Technique, no resistance',
  2: 'Flowy, breathing rounds',
  3: 'Working, honest pace',
  4: 'Hard, competitive rounds',
  5: 'All-out, leave it on the mat',
};
const BAR_HEIGHTS = [16, 23, 30, 37, 46];

interface Props {
  value: number;            // 1–5
  onChange: (level: number) => void;
}

export default function EffortMeter({ value, onChange }: Props) {
  const color = INT_COLORS[(value as 1 | 2 | 3 | 4 | 5)] ?? INT_COLORS[3];
  return (
    <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <span style={{ fontFamily: FONT_EDITORIAL, fontSize: 23, fontWeight: 600, letterSpacing: '-0.01em', color }}>
          {INT_LABELS[value] ?? ''}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.44)', textAlign: 'right' }}>
          {DESCRIPTIONS[value] ?? ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', height: 46 }}>
        {BAR_HEIGHTS.map((h, i) => {
          const level = i + 1;
          const on = level <= value;
          return (
            <button
              key={level}
              type="button"
              aria-label={`Intensity ${level}: ${INT_LABELS[level]}`}
              aria-pressed={level === value}
              onClick={() => { vibrate(5); onChange(level); }}
              style={{
                flex: 1,
                height: h,
                borderRadius: 5,
                background: on ? color : 'rgba(255,255,255,0.05)',
                border: `1px solid ${on ? color : 'rgba(255,255,255,0.06)'}`,
                opacity: on ? Number((0.5 + 0.5 * level / value).toFixed(2)) : 1,
                padding: 0,
                cursor: 'pointer',
                transition: 'height .22s cubic-bezier(0.2,0.8,0.2,1), background .18s, opacity .18s',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
