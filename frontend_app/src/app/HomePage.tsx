import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { api } from '../lib/api.ts';
import WaveBackground from '../components/WaveBackground.tsx';
import { CARD_BG, COPPER_BORDER, CARD_SHADOW, PALE_YELLOW, GLOW_TITLE, GLOW_NAV } from '../lib/theme.ts';

type Mode = 'login' | 'register';

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

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const registerData = await api.post<RegisterResponse>('/auth/register', { email, password });
        if (registerData.message !== 'User registered successfully.') {
          setError(registerData.message ?? 'Registration failed.');
          return;
        }
        // auto-login after successful register
      }

      const loginData = await api.post<LoginResponse>('/auth/login', { email, password });
      if (!loginData.token) {
        setError(loginData.message ?? 'Login failed.');
        return;
      }

      login(loginData.token);
      navigate('/home');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-brand-dark px-4 relative"
    >
      <WaveBackground />

      {/* Logo / Title */}
      <div className="mb-10 text-center relative z-10">
        <h1 className="text-5xl font-bold tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_TITLE }}>
          Journada
        </h1>
        <p className="mt-3 text-lg" style={{ color: PALE_YELLOW, textShadow: GLOW_NAV }}>
          For Intentional Grappling
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl p-8 relative z-10" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden mb-6 border border-white/10">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-brand-orange text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-brand-orange text-white'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange"
              placeholder="you@example.com"
            />
          </div>

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

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
