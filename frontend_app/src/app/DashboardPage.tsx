import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { api } from '../lib/api.ts';
import TrainingHeatmap, { type SessionSummary } from '../components/TrainingHeatmap.tsx';
import LogSessionForm from '../components/LogSessionForm.tsx';

interface SessionsResponse {
  sessions: SessionSummary[];
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.get<SessionsResponse>('/api/sessions');
      setSessions(data.sessions);
    } catch {
      // silently fail — heatmap shows empty state
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">

      {/* Nav */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Journada
        </h1>
        <button
          onClick={handleLogout}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          Log out
        </button>
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
