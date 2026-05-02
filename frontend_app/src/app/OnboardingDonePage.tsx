// /onboarding/done — first-action takeover. Pattern: Alive (Refero `80e90b55-…`).
// Calm forest-green takeover, "Your first session. Logged." in champagne
// Cormorant. No animation past fade-in.
//
// If the PWA is installed (standalone display mode), we offer the
// notification primer here. Otherwise we just send the user to /home.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingShell from '../components/OnboardingShell.tsx';
import NotificationPermissionPrimer from '../components/NotificationPermissionPrimer.tsx';
import { useOnboardingState } from '../hooks/useOnboardingState.ts';
import { isStandaloneInstall } from '../lib/pushClient.ts';
import {
  COPPER, COPPER_BORDER, PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';

export default function OnboardingDonePage() {
  const navigate = useNavigate();
  const { markComplete } = useOnboardingState();
  const [primerOpen, setPrimerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const installed = isStandaloneInstall();

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markComplete();
      navigate('/home');
    } catch {
      // Even if the mark fails, get the user out — they can re-trigger via Profile later.
      navigate('/home');
    }
  };

  return (
    <OnboardingShell step={4}>
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', textAlign: 'center',
          marginTop: 32, paddingBottom: 24,
          animation: 'j2-fade-in 480ms ease both',
        }}
      >
        <style>{`
          @keyframes j2-fade-in { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        <p
          style={{
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: COPPER, marginBottom: 14,
          }}
        >
          ◇ Your record begins
        </p>
        <h1
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 36, lineHeight: 1.2,
            color: PALE_YELLOW, textShadow: GLOW_SOFT,
            marginBottom: 16, maxWidth: 360,
          }}
        >
          Your first session. Logged.
        </h1>
        <p
          style={{
            fontFamily: FONT_EDITORIAL, fontStyle: 'italic',
            fontSize: 17, color: 'rgba(242,228,168,0.62)',
            lineHeight: 1.5, maxWidth: 320,
          }}
        >
          We'll keep your training record from here. Add as much or as little as you like, whenever you want.
        </p>
      </div>

      {/* Conditional notification offer — only when installed as a PWA. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {installed && (
          <button
            onClick={() => setPrimerOpen(true)}
            disabled={busy}
            style={{
              backgroundColor: 'transparent',
              color: PALE_YELLOW,
              fontSize: 14, fontWeight: 600,
              padding: '12px 20px', borderRadius: 12,
              border: `1px solid ${COPPER_BORDER}`,
              cursor: busy ? 'not-allowed' : 'pointer',
              width: '100%',
            }}
          >
            Set up class-time reminders
          </button>
        )}
        <button
          onClick={() => void finish()}
          disabled={busy}
          style={{
            backgroundColor: COPPER,
            color: '#fff',
            fontSize: 16, fontWeight: 600,
            padding: '14px 24px', borderRadius: 12,
            border: `1px solid ${COPPER_BORDER}`,
            cursor: busy ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {busy ? 'Just a moment…' : 'Continue'}
        </button>
      </div>

      <NotificationPermissionPrimer
        open={primerOpen}
        onClose={() => setPrimerOpen(false)}
        onSubscribed={() => void finish()}
      />
    </OnboardingShell>
  );
}
