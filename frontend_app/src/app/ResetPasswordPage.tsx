import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.ts';
import WaveBackground from '../components/WaveBackground.tsx';
import { CARD_BG, COPPER_BORDER, CARD_SHADOW, PALE_YELLOW, GLOW_TITLE, GLOW_NAV } from '../lib/theme.ts';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center bg-brand-dark px-4 relative overflow-hidden">
      <WaveBackground />

      <div className="mb-10 text-center relative z-10">
        <h1 className="text-5xl font-wordmark tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_TITLE }}>
          Journada
        </h1>
        <p className="mt-3 text-lg" style={{ color: PALE_YELLOW, textShadow: GLOW_NAV }}>
          For Intentional Grappling
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-8 relative z-10"
        style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}
      >
        <div className="mb-6">
          <h2 className="text-white font-semibold text-lg">Set a new password</h2>
          <p className="text-white/50 text-sm mt-1">Enter and confirm your new password below.</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-green-400">
              Your password has been updated. You can now log in with your new password.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold py-2.5 rounded-full transition-colors"
            >
              Go to Log In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {!token && (
              <p className="text-sm text-red-400">
                No reset token found. Please use the link from your email.
              </p>
            )}

            <div>
              <label className="block text-sm text-white/70 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold py-2.5 rounded-full transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Back to Log In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
