// useCanonicalConstraints — loads the global, curated CLA constraint vocabulary.
// Mirrors useCanonicalPositions: module-level promise, shared across all callers,
// fetched once. Constraints rarely change (admin-curated via migrations).

import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api.ts';
import type { CanonicalConstraint, CanonicalConstraintsResponse, Pillar } from '../types/api.ts';

let cachedPromise: Promise<CanonicalConstraint[]> | null = null;

function loadOnce(): Promise<CanonicalConstraint[]> {
  if (!cachedPromise) {
    cachedPromise = api
      .get<CanonicalConstraintsResponse>('/api/canonical-constraints')
      .then(res => res.constraints ?? [])
      .catch(err => {
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
}

export function useCanonicalConstraints() {
  const [constraints, setConstraints] = useState<CanonicalConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadOnce()
      .then(rows => { if (alive) { setConstraints(rows); setError(null); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Failed to load constraint library'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Group by pillar; null parent_pillar (cross-pillar constraints) bucketed under '_any'.
  const byPillar = useMemo(() => {
    const grouped: Record<Pillar | '_any', CanonicalConstraint[]> = {
      standup: [], passing: [], pins: [], submissions: [], guard: [], _any: [],
    };
    for (const c of constraints) {
      if (c.parent_pillar) grouped[c.parent_pillar].push(c);
      else grouped._any.push(c);
    }
    return grouped;
  }, [constraints]);

  const byId = useMemo(() => {
    const m = new Map<string, CanonicalConstraint>();
    for (const c of constraints) m.set(c.id, c);
    return m;
  }, [constraints]);

  return { constraints, byPillar, byId, loading, error };
}
