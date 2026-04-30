import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import TrainingHeatmap from '../components/TrainingHeatmap.tsx';
import CompactHeatmap from '../components/CompactHeatmap.tsx';
import CalendarHeatmap from '../components/CalendarHeatmap.tsx';
import LogSessionForm from '../components/LogSessionForm.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { LayoutGrid, CalendarDays, Search, X } from 'lucide-react';
import SessionSearchPanel from '../components/SessionSearchPanel.tsx';
import { PALE_YELLOW, GLOW_SOFT, COPPER, SURFACE_2 } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import type { SessionSummary, CalendarIntention, SessionsResponse, IntentionsResponse } from '../types/api.ts';

export default function CalendarPage() {
  const isDesktop = useIsDesktop();
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [intentions,  setIntentions]  = useState<CalendarIntention[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [flipDir,     setFlipDir]     = useState<'forward' | 'back' | null>(null);
  const [logDate,     setLogDate]     = useState<string | null>(null); // YYYY-MM-DD for log-from-calendar
  const [searchOpen,  setSearchOpen]  = useState(false);

  // View toggle — compact hero vs full detailed heatmap
  type CalendarViewMode = 'compact' | 'detailed';
  const [calView, setCalView] = useState<CalendarViewMode>(
    () => (localStorage.getItem('j2_cal_view') as CalendarViewMode) || 'detailed'
  );
  const handleCalViewChange = useCallback((mode: CalendarViewMode) => {
    setCalView(mode);
    localStorage.setItem('j2_cal_view', mode);
  }, []);

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
  useOnlineRefetch(fetchAll);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);

  const currentYear = new Date().getFullYear();

  return (
    <>
    {/* Log session modal — triggered from empty calendar cells */}
    {logDate && (
      <div
        data-no-page-swipe=""
        role="dialog"
        aria-modal="true"
        aria-label="Log session"
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-5"
        style={{
          backgroundColor: 'rgba(13, 26, 20, 1)',
          backdropFilter: 'blur(16px)',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        onClick={() => setLogDate(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-lg lg:max-w-5xl animate-j2-modal-in"
        >
          <LogSessionForm
            onSuccess={() => { fetchAll(); setLogDate(null); }}
            onCancel={() => setLogDate(null)}
            defaultDate={logDate}
          />
        </div>
      </div>
    )}

    <div
      className={isDesktop
        ? 'space-y-5 j2-page-container'
        : 'mx-auto max-w-5xl w-full px-4 sm:px-6'}
      style={isDesktop
        ? { paddingTop: 20, paddingBottom: 20 }
        : {
            paddingTop: 16,
            paddingBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            // Fill the AppShell <main> content area without spawning an outer scroll.
            // Only the calendar grid inside scrolls.
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
          }}
    >

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2
          className="text-2xl font-display font-bold tracking-tight"
          style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
        >
          {displayYear} Mat Time
        </h2>

        <div className="flex items-center gap-2">
          {/* Search toggle */}
          <button
            onClick={() => setSearchOpen(v => !v)}
            className="flex items-center justify-center rounded-lg transition-colors touch-manipulation"
            style={{
              width: 34,
              height: 30,
              backgroundColor: searchOpen ? COPPER : SURFACE_2,
              color: searchOpen ? '#fff' : 'rgba(242,228,168,0.45)',
            }}
            aria-label={searchOpen ? 'Close search' : 'Search sessions'}
          >
            {searchOpen ? <X size={14} /> : <Search size={14} />}
          </button>

          {/* View toggle */}
          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: SURFACE_2 }}>
            {([
              { id: 'compact' as const, Icon: LayoutGrid },
              { id: 'detailed' as const, Icon: CalendarDays },
            ]).map(({ id, Icon }) => {
              const isActive = calView === id;
              return (
                <button
                  key={id}
                  onClick={() => handleCalViewChange(id)}
                  className="flex items-center justify-center rounded-md transition-colors touch-manipulation"
                  style={{
                    width: 34,
                    height: 30,
                    backgroundColor: isActive ? COPPER : 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                    transition: 'background-color 200ms ease, color 200ms ease',
                  }}
                  aria-label={id === 'compact' ? 'Compact view' : 'Detailed view'}
                >
                  <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
                </button>
              );
            })}
          </div>

          {/* Year navigation — same pill treatment as view toggle */}
          <div className="flex items-center p-0.5 rounded-lg" style={{ backgroundColor: SURFACE_2 }}>
            <button
              onClick={() => navigateYear(-1)}
              aria-label="Previous year"
              className="p-1.5 rounded-md hover:bg-white/5 transition-colors touch-manipulation"
              style={{ color: 'rgba(242,228,168,0.45)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span
              className="w-10 text-center select-none"
              style={{ fontSize: 13, fontWeight: 600, color: 'rgba(242,228,168,0.85)' }}
            >
              {displayYear}
            </span>
            <button
              onClick={() => navigateYear(1)}
              disabled={displayYear >= currentYear}
              aria-label="Next year"
              className="p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed touch-manipulation"
              style={{ color: 'rgba(242,228,168,0.45)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}

      {searchOpen ? (
        <SessionSearchPanel
          cachedSessions={allSessions}
          onRefresh={fetchAll}
        />
      ) : (
        <ErrorBoundary>
          <div
            key={displayYear}
            onAnimationEnd={() => setFlipDir(null)}
            style={{
              ...(isDesktop ? null : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }),
              ...(flipDir ? {
                animation: `j2PageFlip${flipDir === 'forward' ? 'Forward' : 'Back'} 380ms ease-out both`,
              } : null),
            }}
          >
            {calView === 'compact' ? (
              isDesktop ? (
                <CalendarHeatmap
                  sessions={allSessions}
                  year={displayYear}
                  onLogSession={(dateKey) => setLogDate(dateKey)}
                />
              ) : (
                <CompactHeatmap
                  sessions={allSessions}
                  year={displayYear}
                  loading={loading}
                  fillHeight
                />
              )
            ) : (
              <TrainingHeatmap
                sessions={allSessions}
                intentions={intentions}
                loading={loading}
                onSessionUpdated={fetchAll}
                onGoToToday={() => setDisplayYear(currentYear)}
                onLogSession={(dateKey) => setLogDate(dateKey)}
                year={displayYear}
                fillHeight={!isDesktop}
              />
            )}
          </div>
        </ErrorBoundary>
      )}
    </div>
    </>
  );
}
