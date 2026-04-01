import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../lib/api.ts';
import TrainingHeatmap, { type SessionSummary } from '../components/TrainingHeatmap.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';

interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface CalendarIntention {
  id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  duration_days: number;
}

interface IntentionsResponse {
  intentions: CalendarIntention[];
}

export default function CalendarPage() {
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [intentions,  setIntentions]  = useState<CalendarIntention[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [flipDir,     setFlipDir]     = useState<'forward' | 'back' | null>(null);

  const navigateYear = (dir: 1 | -1) => {
    setFlipDir(dir === 1 ? 'forward' : 'back');
    setDisplayYear(y => y + dir);
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const [sesData, intData] = await Promise.all([
        api.get<SessionsResponse>(`/api/sessions?from=${displayYear}-01-01&to=${displayYear}-12-31`),
        api.get<IntentionsResponse>('/api/intentions'),
      ]);
      setSessions(sesData.sessions ?? []);
      setIntentions(intData.intentions ?? []);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setFetchError('Could not load sessions. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, [displayYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const currentYear = new Date().getFullYear();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
        >
          {displayYear} Mat Time
        </h2>

        {/* Year navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateYear(-1)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-sm font-medium text-white/60 w-10 text-center">{displayYear}</span>
          <button
            onClick={() => navigateYear(1)}
            disabled={displayYear >= currentYear}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}

      <ErrorBoundary>
        <div
          key={displayYear}
          onAnimationEnd={() => setFlipDir(null)}
          style={flipDir ? {
            animation: `j2PageFlip${flipDir === 'forward' ? 'Forward' : 'Back'} 380ms ease-out both`,
          } : undefined}
        >
          <TrainingHeatmap
            sessions={sessions}
            intentions={intentions}
            loading={loading}
            onSessionUpdated={fetchAll}
            onGoToToday={() => setDisplayYear(currentYear)}
            year={displayYear}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
}
