import { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import type { BeltHistoryEntry, BeltHistoryResponse } from '../types/api.ts';

export function useBeltHistory() {
  const [entries, setEntries] = useState<BeltHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get<BeltHistoryResponse>('/api/belt-history')
      .then(res => { if (!cancelled) setEntries(res.belt_history ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { entries, loading };
}
