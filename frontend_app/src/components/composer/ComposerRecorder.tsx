// frontend_app/src/components/composer/ComposerRecorder.tsx
// Capture Composer screen 2 — mic-hot recording stage. The Prism breathes as
// the recording indicator (brand symbol as waveform); the live transcript
// streams beneath in the editorial serif so the entry already reads like a
// journal page. Presentational: speech state comes in as props. Spec §2 state 2.

import PrismMotif from '../visuals/PrismMotif.tsx';
import { FONT_EDITORIAL, TEXT_TERTIARY, TEXT_HINT } from '../../lib/theme.ts';
import { vibrate } from '../../lib/haptics.ts';

interface Props {
  kernelCaption: string;
  transcript: string;
  elapsed: number;       // seconds
  onStop: () => void;
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export default function ComposerRecorder({ kernelCaption, transcript, elapsed, onStop }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
      <p style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_HINT, textAlign: 'center', margin: '0 0 6px' }}>
        {kernelCaption}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT_TERTIARY }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#E25555', marginRight: 7, animation: 'j2-mic-pulse-dot 1.4s ease-in-out infinite' }} />Recording</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(elapsed)}</span>
      </div>
      <style>{`@keyframes j2-mic-pulse-dot { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0 8px' }}>
        <PrismMotif size={140} intensity="hero" breathRate="moderate" />
      </div>

      <div
        aria-live="polite"
        style={{
          flex: 1, fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 16.5,
          lineHeight: 1.65, color: 'rgba(242,228,168,0.72)', overflowY: 'auto', paddingTop: 8, minHeight: 120,
        }}
      >
        {transcript || <span style={{ opacity: 0.4 }}>Start talking — the page is listening…</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
        <button
          type="button"
          aria-label="Stop recording"
          onClick={() => { vibrate(8); onStop(); }}
          className="touch-manipulation"
          style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--j2-surface-2)',
            border: '1.5px solid rgba(196,145,95,0.40)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 0 24px rgba(196,145,95,0.18)',
          }}
        >
          <span style={{ width: 20, height: 20, borderRadius: 5, background: '#E25555', display: 'block' }} />
        </button>
      </div>
    </div>
  );
}
