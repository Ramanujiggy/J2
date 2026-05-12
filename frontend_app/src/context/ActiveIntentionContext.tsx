// ActiveIntentionContext — shared "which intention covers today" state.
//
// Any page in the protected shell can read the current active intention and
// trigger a refresh after a mutation. The desktop rail's focus card reads
// from here so it stays in sync whether the user sets a focus from
// PathAheadPage, IntentionsPage, or a modal.
//
// The context fetches `/api/intentions` once on mount and again whenever a
// consumer calls `refresh()`. It intentionally does NOT fetch sessions —
// pages that need alignment/session data fetch those independently.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import type { Intention, IntentionsResponse } from '../types/api.ts';
import { toDateString, addDays } from '../lib/sessionUtils.ts';

interface ActiveIntentionContextValue {
  /** Intention whose [week_start, week_start + duration_days - 1] covers today, or null. */
  activeIntention: Intention | null;
  /** All intentions in reverse-chronological order (newest first). */
  intentions: Intention[];
  /** True until the first fetch completes. */
  loading: boolean;
  /** Trigger a refetch. Call after any create/edit/delete mutation. */
  refresh: () => Promise<void>;
}

const ActiveIntentionContext = createContext<ActiveIntentionContextValue>({
  activeIntention: null,
  intentions: [],
  loading: true,
  refresh: async () => {},
});

export function ActiveIntentionProvider({ children }: { children: React.ReactNode }) {
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<IntentionsResponse>('/api/intentions');
      setIntentions(res.intentions ?? []);
    } catch (err) {
      // 401s happen after logout — swallow silently so the rail doesn't
      // scream about it. Anything else we treat as transient; the rail
      // will just keep showing the last-known state (or the stub).
      if (!(err instanceof ApiError && err.status === 401)) {
        console.error('Failed to load intentions', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const activeIntention = useMemo(() => {
    const todayStr = toDateString(new Date());
    return intentions.find(i => {
      const start = i.week_start.slice(0, 10);
      const end = addDays(start, (i.duration_days ?? 7) - 1);
      return todayStr >= start && todayStr <= end;
    }) ?? null;
  }, [intentions]);

  const value = useMemo<ActiveIntentionContextValue>(
    () => ({ activeIntention, intentions, loading, refresh }),
    [activeIntention, intentions, loading, refresh],
  );

  return (
    <ActiveIntentionContext.Provider value={value}>
      {children}
    </ActiveIntentionContext.Provider>
  );
}

export function useActiveIntention() {
  return useContext(ActiveIntentionContext);
}
