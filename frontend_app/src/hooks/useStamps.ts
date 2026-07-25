import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.ts';
import type { EarnedStamp, StampsResponse } from '../types/api.ts';

// Loads the user's earned stamps as a Map keyed by die_key for O(1) lookups
// (earned vs locked, current strike count). Mirrors useBeltHistory's fetchKey
// refetch pattern.
export function useStamps() {
  const [stamps, setStamps] = useState<Map<string, EarnedStamp>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<StampsResponse>('/api/stamps')
      .then(res => {
        if (cancelled) return;
        setStamps(new Map((res.stamps ?? []).map(s => [s.die_key, s])));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  return { stamps, loading, refetch };
}
