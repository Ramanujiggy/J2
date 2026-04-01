import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { api, ApiError } from '../lib/api.ts';
import WaveBackground from '../components/WaveBackground.tsx';
import { CARD_BG, COPPER_BORDER, CARD_SHADOW, PALE_YELLOW, GLOW_TITLE, GLOW_NAV } from '../lib/theme.ts';

type Mode = 'login' | 'register' | 'forgot';

interface RegisterResponse {
  message: string;
}

interface LoginResponse {
  message: string;
  token?: string;
  user?: { id: string; email: string };
}

export default function HomePage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

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

      if (mode === 'register') {
        const registerData = await api.post<RegisterResponse>('/auth/register', { email, password });
        if (registerData.message !== 'User registered successfully.') {
          setError(registerData.message ?? 'Registration failed.');
          return;
        }
        // auto-login after successful register
      }

      const loginData = await api.post<LoginResponse>('/auth/login', { email, password });
      if (!loginData.token?.trim()) {
        setError(loginData.message ?? 'Login failed.');
        return;
      }

      login(loginData.token);
      navigate('/home');
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

  return (
    <div
      className="min-h-screen min-h-dvh flex flex-col items-center justify-center bg-brand-dark px-4 relative overflow-hidden"
    >
      <WaveBackground />

      {/* Logo / Title */}
      <div
        className="mb-10 text-center relative z-10 px-8 py-5 rounded-2xl"
        style={{ backgroundColor: 'rgba(13, 26, 20, 0.45)', backdropFilter: 'blur(4px)' }}
      >
        <h1 className="text-3xl sm:text-5xl font-display tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_TITLE }}>
          Journada
        </h1>
        <p className="mt-3 text-lg" style={{ color: PALE_YELLOW, textShadow: GLOW_NAV }}>
          For Intentional Grappling
        </p>
      </div>

      {/* Card */}
      <div className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-8 relative z-10" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}>

        {/* Mode toggle — sliding pill, only show for login/register */}
        {mode !== 'forgot' && (
          <div className="flex rounded-lg overflow-hidden mb-6 border border-white/10 relative" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            {/* Sliding pill background */}
            <div
              className="absolute top-0 bottom-0 rounded-lg"
              style={{
                width: '50%',
                backgroundColor: '#DA7422',
                transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
            <button
              onClick={() => switchMode('login')}
              className="flex-1 py-2 text-sm font-medium relative z-10 transition-colors"
              style={{ color: mode === 'login' ? 'white' : 'rgba(255,255,255,0.5)' }}
            >
              Log In
            </button>
            <button
              onClick={() => switchMode('register')}
              className="flex-1 py-2 text-sm font-medium relative z-10 transition-colors"
              style={{ color: mode === 'register' ? 'white' : 'rgba(255,255,255,0.5)' }}
            >
              Register
            </button>
          </div>
        )}

        {/* Forgot password header */}
        {mode === 'forgot' && (
          <div className="mb-6">
            <h2 className="text-white font-semibold text-lg">Reset your password</h2>
            <p className="text-white/50 text-sm mt-1">
              Enter your email and we'll send you a reset link.
            </p>
          </div>
        )}

        {/* Confirmation message after reset email sent */}
        {forgotSent ? (
          <div className="space-y-4">
            <p className="text-sm text-green-400">
              If that email is registered, a reset link has been sent. Check your inbox.
            </p>
            <button
              onClick={() => switchMode('login')}
              className="w-full text-sm text-white/50 hover:text-white transition-colors"
            >
              Back to Log In
            </button>
          </div>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Email</label>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="you@example.com"
                />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="block text-sm text-white/70 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 j2-press"
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

            {/* Forgot password link — only shown in login mode */}
            {mode === 'login' && (
              <button
                onClick={() => switchMode('forgot')}
                className="mt-4 w-full text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Forgot your password?
              </button>
            )}

            {/* Back to login — shown in forgot mode */}
            {mode === 'forgot' && (
              <button
                onClick={() => switchMode('login')}
                className="mt-4 w-full text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Back to Log In
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
