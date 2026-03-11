import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { api, ApiError } from '../lib/api.ts';
import TrainingHeatmap, { type SessionSummary } from '../components/TrainingHeatmap.tsx';
import LogSessionForm from '../components/LogSessionForm.tsx';
import BeltBar, { type BeltRank } from '../components/BeltBar.tsx';

interface SessionsResponse {
  sessions: SessionSummary[];
}

interface ProfileResponse {
  profile: { belt_rank: string | null; stripes: number } | null;
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [beltRank, setBeltRank] = useState<BeltRank | null>(null);
  const [stripes, setStripes] = useState(0);

  const fetchSessions = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await api.get<SessionsResponse>('/api/sessions');
      setSessions(data.sessions ?? []);
    } catch (err) {
      // 401s are handled globally by AuthContext (auto-logout + redirect).
      // Only surface unexpected errors (network down, 500, etc.).
      if (!(err instanceof ApiError && err.status === 401)) {
        setFetchError('Could not load sessions. Please refresh.');
      }
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<ProfileResponse>('/api/profile');
      if (data.profile) {
        setBeltRank((data.profile.belt_rank as BeltRank) ?? null);
        setStripes(data.profile.stripes ?? 0);
      }
    } catch {
      // non-critical — belt bar just won't render
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchProfile();
  }, [fetchSessions, fetchProfile]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">

      {/* Nav */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="w-fit">
          <h1 className="text-xl font-bold tracking-tight text-white">Journada</h1>
          <BeltBar rank={beltRank} stripes={stripes} />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-10">

        {/* Log a session */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Log a Training Session
          </h2>
          <LogSessionForm onSuccess={fetchSessions} />
        </section>

        {fetchError && (
          <p className="text-sm text-red-400">{fetchError}</p>
        )}

        {/* Training history heatmap */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Training History
          </h2>
          <TrainingHeatmap sessions={sessions} />
        </section>

      </main>
    </div>
  );
}
