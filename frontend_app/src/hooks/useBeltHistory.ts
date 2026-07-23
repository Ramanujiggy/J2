import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.ts';
import type { BeltHistoryEntry, BeltHistoryResponse } from '../types/api.ts';

export function useBeltHistory() {
  const [entries, setEntries] = useState<BeltHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<BeltHistoryResponse>('/api/belt-history')
      .then(res => { if (!cancelled) setEntries(res.belt_history ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  return { entries, loading, refetch };
}
