import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { api, ApiError } from '../lib/api.ts';
import WaveBackground from '../components/WaveBackground.tsx';
import { PAGE_BG, PALE_YELLOW, GLOW_TITLE, GLOW_SOFT, GLOW_NAV, COPPER_BORDER } from '../lib/theme.ts';
import TrainingHeatmap, { type SessionSummary } from '../components/TrainingHeatmap.tsx';
import LogSessionForm from '../components/LogSessionForm.tsx';
import BeltBar, { type BeltRank } from '../components/BeltBar.tsx';
import SkillRadar from '../components/SkillRadar.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';

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
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [beltRank, setBeltRank] = useState<BeltRank | null>(null);
  const [stripes, setStripes] = useState(0);
  const [logOpen, setLogOpen] = useState(false);

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
    } finally {
      setSessionsLoading(false);
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
      <header className="border-b px-6 py-4 flex items-center justify-between relative overflow-hidden" style={{ borderBottomColor: COPPER_BORDER }}>
        <WaveBackground />
        {/* Fade the wave out downward into the page background */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 20%, ${PAGE_BG} 100%)`, pointerEvents: 'none' }} />
        <div className="w-fit relative z-10">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_TITLE }}>Journada</h1>
          <BeltBar rank={beltRank} stripes={stripes} />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <button
            onClick={() => navigate('/profile')}
            className="text-sm transition-colors"
            style={{ color: PALE_YELLOW, textShadow: GLOW_NAV }}
          >
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="text-sm transition-colors"
            style={{ color: PALE_YELLOW, textShadow: GLOW_NAV }}
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-10">

        {fetchError && (
          <p className="text-sm text-red-400">{fetchError}</p>
        )}

        {/* Training history */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>{new Date().getFullYear()} Mat Time</h2>
            <button
              onClick={() => setLogOpen(true)}
              className="bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + Mat Time
            </button>
          </div>
          <ErrorBoundary>
            <TrainingHeatmap sessions={sessions} loading={sessionsLoading} onSessionUpdated={fetchSessions} beltRank={beltRank} stripes={stripes} />
          </ErrorBoundary>
        </section>

        {/* Analytics */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-4" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>Analytics</h2>
          <ErrorBoundary>
            <SkillRadar sessions={sessions} />
          </ErrorBoundary>
        </section>

      </main>

      {/* Log session modal */}
      {logOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-5"
          style={{ backgroundColor: 'rgba(38, 70, 83, 0.85)' }}
          onClick={() => setLogOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg overflow-y-auto max-h-[85vh]">
            <LogSessionForm
              onSuccess={() => { fetchSessions(); setLogOpen(false); }}
              onCancel={() => setLogOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
