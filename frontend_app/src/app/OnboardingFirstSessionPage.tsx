// /onboarding/first-session — guided first session log. Wraps LogSessionForm
// with editorial header copy and a Prism inline coachmark.
//
// Copy: "Log a session — you can add details later." (locked by user)
// The Prism inline hint reflects the framing decision: the Prism is one of
// the views, not the stated flagship feature.

import { useNavigate } from 'react-router-dom';
import LogSessionForm from '../components/LogSessionForm.tsx';
import Coachmark from '../components/Coachmark.tsx';
import OnboardingShell from '../components/OnboardingShell.tsx';
import { useCoachmark } from '../hooks/useCoachmark.ts';
import {
  COPPER, PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';

export default function OnboardingFirstSessionPage() {
  const navigate = useNavigate();
  const { isOpen, dismiss } = useCoachmark('prism-log');

  const onSuccess = () => {
    navigate('/onboarding/done');
  };

  return (
    <OnboardingShell step={3}>
      {/* Editorial header — keep it short; the form below is the work. */}
      <div style={{ marginTop: 24, marginBottom: 18 }}>
        <p
          style={{
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: COPPER, marginBottom: 8,
          }}
        >
          ◇ Your first entry
        </p>
        <h1
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 26, lineHeight: 1.25,
            color: PALE_YELLOW, textShadow: GLOW_SOFT, marginBottom: 6,
          }}
        >
          Log a session — you can add details later.
        </h1>
        <p style={{ color: 'rgba(242,228,168,0.55)', fontSize: 14 }}>
          A few taps gets you started. Everything is editable from the journal.
        </p>
      </div>

      {/* The actual log form — same component used everywhere else. */}
      <div style={{ flex: 1 }}>
        <LogSessionForm onSuccess={onSuccess} />
      </div>

      <Coachmark
        open={isOpen}
        onDismiss={dismiss}
        eyebrow="◇ Pillars"
        title="Tap a face to mark what you focused on."
        body="The shape grows with your sessions. It's one of the views you'll see — every entry adds to your record."
        ctaLabel="Got it"
      />
    </OnboardingShell>
  );
}
