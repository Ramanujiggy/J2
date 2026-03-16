import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../lib/api.ts';
import SkillRadar from '../components/SkillRadar.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';
import type { SessionSummary } from '../components/TrainingHeatmap.tsx';

interface SessionsResponse {
  sessions: SessionSummary[];
}

export default function AnalyticsPage() {
  const [sessions,   setSessions]   = useState<SessionSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await api.get<SessionsResponse>('/api/sessions');
      setSessions(data.sessions ?? []);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setFetchError('Could not load sessions. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-white/30">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      <h2
        className="text-2xl font-bold tracking-tight"
        style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
      >
        Analytics
      </h2>

      {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}

      <ErrorBoundary>
        <SkillRadar sessions={sessions} />
      </ErrorBoundary>
    </div>
  );
}
