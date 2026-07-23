// Capture Composer screen 4 — the receipt. Shows what the app understood
// (PrismShape from confirmed chips) and the flow's ONLY structured ask: one
// optional intensity tap, pre-set to 3. Spec §2 state 4.

import PrismShape from '../PrismShape.tsx';
import { FONT_EDITORIAL, PALE_YELLOW, COPPER } from '../../lib/theme.ts';
import { vibrate } from '../../lib/haptics.ts';
import type { ChipSelection } from '../../lib/selectionsToDistribution.ts';

interface Props {
  selections: ChipSelection[];
  headline: string;
  intensity: number;
  onIntensity: (n: number) => void;
  onSeal: () => void;
  sealing: boolean;
}

export default function ComposerReceipt({ selections, headline, intensity, onIntensity, onSeal, sealing }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 4px 4px' }}>
      <p className="j2-label-copper" style={{ margin: '0 0 6px' }}>◇ Entry saved to</p>
      <h3 style={{ fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 27, color: PALE_YELLOW, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
        {headline}
      </h3>

      <PrismShape selections={selections} size={190} showLabels={true} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '14px 0 4px' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            aria-label={`Intensity ${n}`}
            aria-pressed={intensity === n}
            onClick={() => { vibrate(6); onIntensity(n); }}
            className="touch-manipulation"
            style={{
              width: 16, height: 16, borderRadius: '50%',
              background: n <= intensity ? COPPER : 'var(--j2-surface-3)',
              border: n <= intensity ? `1px solid ${COPPER}` : '1px solid rgba(255,255,255,0.12)',
              boxShadow: n <= intensity ? '0 0 10px rgba(196,145,95,0.5)' : 'none',
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.34)', margin: '0 0 18px' }}>
        How hard did it go? · optional
      </p>

      <button
        type="button"
        onClick={() => { vibrate(10); onSeal(); }}
        disabled={sealing}
        className="w-full touch-manipulation"
        style={{
          fontWeight: 700, fontSize: 14.5, color: '#fff', background: '#DA7422',
          borderRadius: 14, padding: 14, opacity: sealing ? 0.6 : 1,
          boxShadow: '0 4px 22px rgba(218,116,34,0.32)',
        }}
      >
        {sealing ? 'Sealing…' : 'Seal the entry'}
      </button>
    </div>
  );
}
