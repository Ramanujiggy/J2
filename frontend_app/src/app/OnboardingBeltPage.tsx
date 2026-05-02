// /onboarding/belt — pick belt rank. Skippable. Pattern: Vocabulary
// (Refero `d06bc328-…`) — large pill rows, copper ring on selected.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import OnboardingShell from '../components/OnboardingShell.tsx';
import {
  COPPER, COPPER_BORDER, PALE_YELLOW, SURFACE_2, SURFACE_2_BORDER,
  FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';
import type { ProfileResponse } from '../types/api.ts';
import type { BeltRank } from '../components/BeltBar.tsx';

const BELTS: { value: BeltRank; label: string; tint: string }[] = [
  { value: 'white',  label: 'White',  tint: 'rgba(255,255,255,0.85)' },
  { value: 'blue',   label: 'Blue',   tint: '#4A6BAA' },
  { value: 'purple', label: 'Purple', tint: '#7A5AAA' },
  { value: 'brown',  label: 'Brown',  tint: '#6F4A2D' },
  { value: 'black',  label: 'Black',  tint: '#1A1A1A' },
];

export default function OnboardingBeltPage() {
  const navigate = useNavigate();
  const { name, refreshProfile, stripes, intentionsEnabled } = useProfile();
  const [selected, setSelected] = useState<BeltRank | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (belt: BeltRank | null) => {
    setBusy(true);
    setError(null);
    try {
      await api.put<ProfileResponse>('/api/profile', {
        name,
        belt_rank: belt,
        stripes,
        intentions_enabled: intentionsEnabled,
      });
      await refreshProfile();
      navigate('/onboarding/first-session');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save belt rank.');
      setBusy(false);
    }
  };

  return (
    <OnboardingShell step={2}>
      <div style={{ marginTop: 24, flex: 1 }}>
        <h1
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 28, lineHeight: 1.2,
            color: PALE_YELLOW, textShadow: GLOW_SOFT, marginBottom: 8,
          }}
        >
          What rank do you train at?
        </h1>
        <p style={{ color: 'rgba(242,228,168,0.55)', fontSize: 14, marginBottom: 26 }}>
          You can change this anytime from your profile.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BELTS.map((b) => {
            const active = selected === b.value;
            return (
              <button
                key={b.value}
                onClick={() => setSelected(b.value)}
                style={{
                  textAlign: 'left',
                  backgroundColor: SURFACE_2,
                  border: `1px solid ${active ? COPPER : SURFACE_2_BORDER}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer',
                  boxShadow: active ? `0 0 0 1px ${COPPER_BORDER} inset, 0 0 16px rgba(196,145,95,0.18)` : 'none',
                  transition: 'border-color 180ms ease, box-shadow 180ms ease',
                }}
              >
                {/* Belt swatch — slim horizontal bar */}
                <div
                  aria-hidden
                  style={{
                    width: 26, height: 14, borderRadius: 3,
                    background: b.tint,
                    border: `1px solid rgba(255,255,255,0.08)`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT_EDITORIAL, fontSize: 18, color: PALE_YELLOW,
                    flex: 1,
                  }}
                >
                  {b.label}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `1px solid ${active ? COPPER : 'rgba(255,255,255,0.18)'}`,
                    background: active ? COPPER : 'transparent',
                    flexShrink: 0,
                  }}
                />
              </button>
            );
          })}
        </div>

        {error && (
          <p style={{ color: 'rgba(255,140,120,0.9)', fontSize: 13, marginTop: 14 }}>{error}</p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
        <button
          onClick={() => void persist(selected)}
          disabled={selected === null || busy}
          style={{
            backgroundColor: selected ? COPPER : 'rgba(196,145,95,0.25)',
            color: selected ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: 16, fontWeight: 600,
            padding: '14px 24px', borderRadius: 12,
            border: `1px solid ${selected ? COPPER_BORDER : 'transparent'}`,
            cursor: selected === null || busy ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
        <button
          onClick={() => void persist(null)}
          disabled={busy}
          style={{
            background: 'transparent',
            color: 'rgba(242,228,168,0.55)',
            fontSize: 13,
            padding: '4px 0',
            cursor: busy ? 'not-allowed' : 'pointer',
            borderBottom: '1px solid rgba(242,228,168,0.18)',
            alignSelf: 'center',
          }}
        >
          Skip for now
        </button>
      </div>
    </OnboardingShell>
  );
}
