// /welcome — public splash for unauthenticated mobile visitors. Desktop
// keeps the existing LandingPage. Pattern: Doji (Refero `f92a8b7a-…`) —
// pure restraint, single CTA, no carousel, no hero illustrations.
//
// Tapping "Begin" funnels into the existing LoginPage in register mode
// with `?from=welcome` so the post-register redirect lands the user on
// /onboarding/name instead of /home.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import {
  PAGE_BG, COPPER, COPPER_BORDER, PALE_YELLOW,
  FONT_EDITORIAL, FONT_WORDMARK, GLOW_TITLE,
} from '../lib/theme.ts';

export default function WelcomeSplashPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // If they're already signed in, don't strand them on the splash.
  useEffect(() => {
    if (isAuthenticated) navigate('/home', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: PAGE_BG,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 24px 40px',
        paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Top: editorial wordmark + subhead */}
      <div style={{ marginTop: 'auto', marginBottom: 'auto', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: FONT_WORDMARK,
            fontSize: 56,
            fontWeight: 600,
            color: PALE_YELLOW,
            textShadow: GLOW_TITLE,
            letterSpacing: '-0.01em',
            marginBottom: 18,
          }}
        >
          Journada
        </h1>
        <p
          style={{
            fontFamily: FONT_EDITORIAL,
            fontStyle: 'italic',
            fontSize: 19,
            color: 'rgba(242,228,168,0.65)',
            lineHeight: 1.45,
            maxWidth: 340,
            margin: '0 auto',
          }}
        >
          A quiet place for your training.
        </p>
      </div>

      {/* Bottom: single primary CTA + sign-in link */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <button
          onClick={() => navigate('/login?mode=register&from=welcome')}
          style={{
            backgroundColor: COPPER,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            padding: '14px 40px',
            borderRadius: 999,
            border: `1px solid ${COPPER_BORDER}`,
            cursor: 'pointer',
            minWidth: 220,
            boxShadow: `0 0 18px rgba(196,145,95,0.22)`,
          }}
        >
          Begin
        </button>
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'transparent',
            color: 'rgba(242,228,168,0.55)',
            fontSize: 13,
            padding: '6px 4px',
            cursor: 'pointer',
            borderBottom: '1px solid rgba(242,228,168,0.2)',
          }}
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}
