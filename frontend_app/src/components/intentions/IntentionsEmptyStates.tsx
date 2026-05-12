// IntentionsEmptyStates — three small empty-state cards used by the desktop
// IntentionsView. Each one fires under a different condition:
//
//   • DesktopEmpty       — no intentions exist at all (career-wide empty)
//   • EmptyFilteredState — the active focus filter yields zero results
//   • EmptyYearState     — the selected year has no intentions
//
// Pure presentation. No state.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER,
} from '../../lib/theme.ts';
import type { Pillar } from '../../types/api.ts';
import { PILLAR_LABEL } from './intentionsTypes.ts';

export function DesktopEmpty({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 16,
        padding: '60px 32px',
        textAlign: 'center',
        maxWidth: 560,
        margin: '40px auto',
      }}
    >
      <h2 className="j2-serif-display" style={{ fontSize: 32, margin: 0 }}>No intentions yet.</h2>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)', lineHeight: 1.6, marginTop: 10 }}>
        Declare what you&rsquo;re working on — each week, each pivot. It&rsquo;ll live here
        as a log of what your training has been <em>about</em>, not just what it was.
      </p>
      <button
        onClick={onStart}
        style={{
          marginTop: 20,
          height: 44, padding: '0 22px',
          background: '#DA7422', color: '#fff',
          fontWeight: 600, borderRadius: 10,
          boxShadow: '0 10px 24px -12px rgba(218,116,34,0.6)',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Set your first intention
      </button>
    </div>
  );
}

export function EmptyFilteredState({ filter }: { filter: Pillar }) {
  return (
    <div
      style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.40)',
        border: '1px dashed rgba(255,255,255,0.10)',
        borderRadius: 16,
      }}
    >
      <div
        className="j2-serif-italic"
        style={{ fontSize: 20, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}
      >
        No weeks of {PILLAR_LABEL[filter]} yet.
      </div>
      <div style={{ fontSize: 14 }}>Try another category.</div>
    </div>
  );
}

export function EmptyYearState({ year }: { year: string }) {
  return (
    <div
      style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.40)',
        border: '1px dashed rgba(255,255,255,0.10)',
        borderRadius: 16,
      }}
    >
      <div
        className="j2-serif-italic"
        style={{ fontSize: 20, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}
      >
        No intentions in {year || 'this year'}.
      </div>
      <div style={{ fontSize: 14 }}>Pick another year above.</div>
    </div>
  );
}
