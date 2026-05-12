// useCanonicalPositions — loads the global, curated BJJ-position vocabulary.
//
// The canonical library mutates rarely (only via backend migrations or admin
// tooling) so we fetch once and cache via a module-level promise. All callers
// share the same fetch — no thundering-herd on page load.

import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api.ts';
import type { CanonicalPosition, CanonicalPositionsResponse, Pillar } from '../types/api.ts';

let cachedPromise: Promise<CanonicalPosition[]> | null = null;

function loadOnce(): Promise<CanonicalPosition[]> {
  if (!cachedPromise) {
    cachedPromise = api
      .get<CanonicalPositionsResponse>('/api/canonical-positions')
      .then(res => res.positions ?? [])
      .catch(err => {
        // Reset the cache on failure so the next mount retries instead of
        // replaying the rejected promise forever.
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
}

export function useCanonicalPositions() {
  const [positions, setPositions] = useState<CanonicalPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadOnce()
      .then(rows => { if (alive) { setPositions(rows); setError(null); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Failed to load library'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const byPillar = useMemo(() => {
    const grouped: Record<Pillar, CanonicalPosition[]> = {
      standup: [], passing: [], pins: [], submissions: [], guard: [],
    };
    for (const p of positions) grouped[p.parent_pillar].push(p);
    return grouped;
  }, [positions]);

  const byId = useMemo(() => {
    const m = new Map<string, CanonicalPosition>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  return { positions, byPillar, byId, loading, error };
}
