// SessionsContext — shared "all my sessions" state.
//
// Mirrors ActiveIntentionContext (2026-05-09 perf audit Tier 3 #8). Five pages
// (Atlas / Intentions / Journal / SessionDetail / PathAhead / Calendar) used
// to each fetch /api/sessions on mount independently — for users browsing
// nav-tab → nav-tab that is N redundant requests + N parses + N parents
// re-rendering charts that depend on a fresh `sessions` array.
//
// This context fetches /api/sessions once on mount (newest-first, ≤1000 per
// the backend's mig-029 default LIMIT) and exposes a `refresh()` that
// consumers call after any mutation (log/edit/delete a session).
//
// Pages that need a specific date window (CalendarPage's `?from=YYYY-01-01&
// to=YYYY-12-31`, PathAheadPage's prior-year+5d window) keep their dedicated
// fetches — the context's default is the broadest "your most recent training"
// view, not arbitrary windows.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import type { SessionSummary, SessionsResponse } from '../types/api.ts';

interface SessionsContextValue {
  /** Newest-first; ≤1000 (backend default LIMIT). */
  sessions: SessionSummary[];
  /** True until the first fetch completes. */
  loading: boolean;
  /** Last fetch error, or null. */
  error: string | null;
  /** Trigger a full refetch. Call after any mutation that may affect ordering or
   *  server-computed fields. For simple creates/updates/deletes prefer the
   *  optimistic helpers below — they update local state instantly. */
  refresh: () => Promise<void>;
  /** Optimistic: prepend a newly-created session without a network round-trip. */
  applyAdd: (session: SessionSummary) => void;
  /** Optimistic: replace an edited session in-place without a network round-trip. */
  applyUpdate: (session: SessionSummary) => void;
  /** Optimistic: remove a deleted session immediately without a network round-trip. */
  applyRemove: (id: string) => void;
}

const SessionsContext = createContext<SessionsContextValue>({
  sessions: [],
  loading: true,
  error: null,
  refresh: async () => {},
  applyAdd: () => {},
  applyUpdate: () => {},
  applyRemove: () => {},
});

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyAdd    = useCallback((session: SessionSummary) => setSessions(prev => [session, ...prev]), []);
  const applyUpdate = useCallback((session: SessionSummary) => setSessions(prev => prev.map(s => s.id === session.id ? session : s)), []);
  const applyRemove = useCallback((id: string)              => setSessions(prev => prev.filter(s => s.id !== id)), []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<SessionsResponse>('/api/sessions');
      setSessions(res.sessions ?? []);
    } catch (err) {
      // 401s happen after logout — swallow silently. Anything else surfaces
      // as a transient error; consumers may choose to display it.
      if (!(err instanceof ApiError && err.status === 401)) {
        setError('Could not load sessions. Please refresh.');
        console.error('Failed to load sessions', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useOnlineRefetch(refresh);

  const value = useMemo<SessionsContextValue>(
    () => ({ sessions, loading, error, refresh, applyAdd, applyUpdate, applyRemove }),
    [sessions, loading, error, refresh, applyAdd, applyUpdate, applyRemove],
  );

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions() {
  return useContext(SessionsContext);
}
