import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { api, ApiError } from '../lib/api.ts';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, PALE_YELLOW, COPPER, SURFACE_3,
} from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import SegmentedToggle from '../components/SegmentedToggle.tsx';
import WaveBackground from '../components/WaveBackground.tsx';

type Mode = 'login' | 'register' | 'forgot';

interface RegisterResponse { message: string }
interface LoginResponse   { message: string; token?: string; user?: { id: string; email: string } }

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const isDesktop = useIsDesktop();

  // Pre-select Register tab when arriving from a landing-page CTA: /login?mode=register
  const initialMode: Mode =
    searchParams.get('mode') === 'register' ? 'register'
    : searchParams.get('mode') === 'forgot' ? 'forgot'
    : 'login';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/home" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'forgot') {
        await api.post('/auth/request-password-reset', { email });
        setForgotSent(true);
        return;
      }

      const wasRegister = mode === 'register';
      if (wasRegister) {
        const registerData = await api.post<RegisterResponse>('/auth/register', { email, password });
        if (registerData.message !== 'User registered successfully.') {
          setError(registerData.message ?? 'Registration failed.');
          return;
        }
      }

      const loginData = await api.post<LoginResponse>('/auth/login', { email, password });
      if (!loginData.token?.trim()) {
        setError(loginData.message ?? 'Login failed.');
        return;
      }

      login(loginData.token);
      // Brand-new users land in the guided onboarding flow. Returning users
      // go to /home — if their onboarding_completed_at is null (e.g. they
      // bailed mid-flow last time), the OnboardingGate inside ProtectedShell
      // will redirect them to /onboarding/name automatically.
      navigate(wasRegister ? '/onboarding/name' : '/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setForgotSent(false);
  };

  // Viewport-tuned sizing
  const wordmarkSize = isDesktop ? 88 : 72;
  const cardPadding = isDesktop ? 36 : 28;
  const cardMaxWidth = isDesktop ? 460 : 400;

  const inputClass = 'w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-colors';
  const inputStyle = {
    backgroundColor: SURFACE_3,
    border: '1px solid rgba(255,255,255,0.08)',
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen min-h-dvh flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ backgroundColor: '#0D1A14' }}
    >
      {/* Animated seigaiha waves — denser SVG pattern with diagonal drift.
          On desktop a soft radial vignette dims the waves toward center so the
          card isn't fighting motion directly behind it; waves stay lively
          at the edges. Mobile sees the full pattern since the card fills
          more of the viewport naturally. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: isDesktop ? 0.6 : 0.8,
          pointerEvents: 'none',
        }}
      >
        <WaveBackground />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: isDesktop
            ? 'radial-gradient(ellipse 520px 620px at center, rgba(13,26,20,0.92) 0%, rgba(13,26,20,0.75) 35%, rgba(13,26,20,0.35) 65%, transparent 100%)'
            : 'radial-gradient(ellipse 380px 440px at center, rgba(13,26,20,0.88) 0%, rgba(13,26,20,0.60) 35%, rgba(13,26,20,0.22) 65%, transparent 100%)',
        }}
      />
      {/* Floor darkening — bottom-up gradient so content lifts off the wave */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(13,26,20,0.82) 0%, rgba(13,26,20,0.45) 35%, transparent 60%)',
        }}
      />

      {/* ── Editorial header ───────────────────────────────────────────── */}
      <div className="relative z-10 text-center mb-8" style={{ maxWidth: cardMaxWidth, width: '100%' }}>
        <p
          className="j2-label-copper"
          style={{ marginBottom: isDesktop ? 14 : 12 }}
        >
          ◇ For intentional grappling
        </p>
        <h1
          className="j2-serif-display j2-heading-glow"
          style={{
            fontSize: wordmarkSize,
            lineHeight: 1,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Journada
        </h1>
      </div>

      {/* ── Auth card ──────────────────────────────────────────────────── */}
      <div
        className="relative z-10 rounded-2xl w-full"
        style={{
          maxWidth: cardMaxWidth,
          padding: cardPadding,
          backgroundColor: CARD_BG,
          border: `1px solid ${CARD_GLOW_BORDER}`,
          boxShadow: CARD_GLOW,
        }}
      >
        {/* Mode toggle — animated slider shared with rest of app */}
        {mode !== 'forgot' && (
          <div className="mb-5">
            <SegmentedToggle
              options={[
                { value: 'login' as const, label: 'Log In' },
                { value: 'register' as const, label: 'Register' },
              ]}
              value={mode === 'register' ? 'register' : 'login'}
              onChange={v => v && switchMode(v as Mode)}
            />
          </div>
        )}

        {/* Forgot password header — editorial treatment */}
        {mode === 'forgot' && (
          <div className="mb-5">
            <p
              className="j2-label-copper"
              style={{ marginBottom: 6 }}
            >
              ◇ Reset your password
            </p>
            <p
              className="j2-serif-italic"
              style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)', lineHeight: 1.5 }}
            >
              Enter your email and we'll send you a reset link.
            </p>
          </div>
        )}

        {forgotSent ? (
          /* ── Post-reset confirmation ─────────────────────────── */
          <div className="space-y-5">
            <div
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: 'rgba(168,203,114,0.08)',
                border: '1px solid rgba(168,203,114,0.25)',
              }}
            >
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(168,203,114,0.90)' }}>
                If that email is registered, a reset link is on its way. Check your inbox.
              </p>
            </div>
            <button
              onClick={() => switchMode('login')}
              className="w-full text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => (e.currentTarget.style.color = PALE_YELLOW)}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              ← Back to Log In
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email */}
              <div>
                <label
                  className="block mb-1.5"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.40)',
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint={mode === 'forgot' ? 'go' : 'next'}
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,145,95,0.55)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.10)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.backgroundColor = SURFACE_3; }}
                  placeholder="you@example.com"
                />
              </div>

              {/* Password */}
              {mode !== 'forgot' && (
                <div>
                  <label
                    className="block mb-1.5"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.40)',
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    enterKeyHint="go"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,145,95,0.55)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.10)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.backgroundColor = SURFACE_3; }}
                    placeholder="••••••••"
                  />
                </div>
              )}

              {error && (
                <p
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{
                    color: 'rgba(248,113,113,0.9)',
                    backgroundColor: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  {error}
                </p>
              )}

              {/* Flagship 52px CTA — matches rest of app */}
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold rounded-xl transition-all touch-manipulation disabled:opacity-50 j2-press"
                style={{
                  height: 52,
                  backgroundColor: '#DA7422',
                  boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
                  fontSize: 15,
                  marginTop: 8,
                }}
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Log In'
                    : mode === 'register'
                      ? 'Create Account'
                      : 'Send Reset Link'}
              </button>
            </form>

            {/* Secondary link — wrapped in a section that gets:
                  • generous top margin (32px) so the link doesn't crowd the CTA
                  • a small centered copper hairline rule above it (gives the
                    under-button area a sense of transition without going heavy)
                  • copper italic-serif on the link itself so it reads as part
                    of the editorial brand voice, not a utility footer link */}
            {(mode === 'login' || mode === 'forgot') && (
              <div className="mt-8 flex flex-col items-center" style={{ gap: 14 }}>
                <span
                  aria-hidden
                  style={{
                    width: 64,
                    height: 1,
                    background: 'rgba(196,145,95,0.22)',
                  }}
                />
                {mode === 'login' && (
                  <button
                    onClick={() => switchMode('forgot')}
                    className="j2-serif-italic transition-colors"
                    style={{
                      fontSize: 14,
                      color: 'rgba(196,145,95,0.78)',
                      lineHeight: 1.2,
                      background: 'transparent',
                      border: 'none',
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = COPPER;
                      e.currentTarget.style.textShadow = '0 0 12px rgba(196,145,95,0.35)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'rgba(196,145,95,0.78)';
                      e.currentTarget.style.textShadow = 'none';
                    }}
                  >
                    Forgot your password?
                  </button>
                )}
                {mode === 'forgot' && (
                  <button
                    onClick={() => switchMode('login')}
                    className="j2-serif-italic transition-colors"
                    style={{
                      fontSize: 14,
                      color: 'rgba(196,145,95,0.78)',
                      lineHeight: 1.2,
                      background: 'transparent',
                      border: 'none',
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = COPPER;
                      e.currentTarget.style.textShadow = '0 0 12px rgba(196,145,95,0.35)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'rgba(196,145,95,0.78)';
                      e.currentTarget.style.textShadow = 'none';
                    }}
                  >
                    ← Back to Log In
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer meditation ──────────────────────────────────────────── */}
      <div
        className="relative z-10 text-center mt-8"
        style={{ maxWidth: cardMaxWidth, width: '100%' }}
      >
        <p
          className="j2-label-micro"
          style={{ color: 'rgba(255,255,255,0.22)' }}
        >
          ·   ·   ·
        </p>
      </div>
    </div>
  );
}
