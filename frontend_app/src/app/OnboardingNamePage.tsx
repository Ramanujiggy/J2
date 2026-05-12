// /onboarding/name — single-field name capture. Persisted via PUT /api/profile.
// Editorial register: large serif heading, single field, copper underline,
// disabled Continue until typed.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useOnboardingState } from '../hooks/useOnboardingState.ts';
import OnboardingShell from '../components/OnboardingShell.tsx';
import {
  COPPER, COPPER_BORDER, PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';
import type { ProfileResponse } from '../types/api.ts';

export default function OnboardingNamePage() {
  const navigate = useNavigate();
  const { refreshProfile, beltRank, stripes, intentionsEnabled } = useProfile();
  const { recordStep } = useOnboardingState();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — "welcome splash tapped". Recorded on mount so users who land
  // here but bail before saving a name are distinguishable from users who
  // never opened the onboarding flow at all (step 0). Fire-and-forget.
  useEffect(() => { void recordStep(1); }, [recordStep]);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 100;

  const onContinue = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      // PUT requires the full profile shape — preserve other fields.
      await api.put<ProfileResponse>('/api/profile', {
        name: trimmed,
        belt_rank: beltRank,
        stripes,
        intentions_enabled: intentionsEnabled,
      });
      await refreshProfile();
      void recordStep(2); // name saved
      navigate('/onboarding/belt');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell step={1}>
      <div style={{ marginTop: 32, flex: 1 }}>
        <h1
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 30, lineHeight: 1.2,
            color: PALE_YELLOW, textShadow: GLOW_SOFT, marginBottom: 8,
          }}
        >
          What should we call you?
        </h1>
        <p style={{ color: 'rgba(242,228,168,0.55)', fontSize: 14, marginBottom: 28 }}>
          Just a first name is fine.
        </p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          autoCapitalize="words"
          autoComplete="given-name"
          enterKeyHint="next"
          maxLength={100}
          placeholder="Your name"
          onKeyDown={(e) => { if (e.key === 'Enter') void onContinue(); }}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: `1.5px solid ${COPPER_BORDER}`,
            color: PALE_YELLOW,
            fontSize: 22,
            fontFamily: FONT_EDITORIAL,
            padding: '10px 2px',
            outline: 'none',
          }}
        />

        {error && (
          <p style={{ color: 'rgba(255,140,120,0.9)', fontSize: 13, marginTop: 14 }}>{error}</p>
        )}
      </div>

      <button
        onClick={() => void onContinue()}
        disabled={!valid || busy}
        style={{
          backgroundColor: valid ? COPPER : 'rgba(196,145,95,0.25)',
          color: valid ? '#fff' : 'rgba(255,255,255,0.4)',
          fontSize: 16, fontWeight: 600,
          padding: '14px 24px', borderRadius: 12,
          border: `1px solid ${valid ? COPPER_BORDER : 'transparent'}`,
          cursor: !valid || busy ? 'not-allowed' : 'pointer',
          width: '100%',
          marginTop: 20,
        }}
      >
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </OnboardingShell>
  );
}
