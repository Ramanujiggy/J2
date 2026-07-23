// useUserConstraints — manages the user's personal constraint library.
// Mirrors useUserTags but constraints carry no video metadata and parent_pillar
// is nullable (some constraints span multiple pillars).

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api.ts';
import type { UserConstraint, UserConstraintsResponse, Pillar } from '../types/api.ts';

interface CreateConstraintInput {
  name: string;
  parent_pillar: Pillar | null;
}

interface CreateConstraintResponse {
  constraint: UserConstraint;
}

export function useUserConstraints() {
  const [constraints, setConstraints] = useState<UserConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConstraints = useCallback(async () => {
    try {
      const res = await api.get<UserConstraintsResponse>('/api/user-constraints');
      setConstraints(res.constraints ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load constraints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchConstraints(); }, [fetchConstraints]);

  const createConstraint = useCallback(async (input: CreateConstraintInput): Promise<UserConstraint | null> => {
    try {
      const res = await api.post<CreateConstraintResponse>('/api/user-constraints', input);
      // Idempotent endpoint — replace if exists, else insert + sort.
      setConstraints(prev => {
        const without = prev.filter(c => c.id !== res.constraint.id);
        return [...without, res.constraint].sort((a, b) => a.name.localeCompare(b.name));
      });
      setError(null);
      return res.constraint;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create constraint');
      return null;
    }
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, UserConstraint>();
    for (const c of constraints) m.set(c.id, c);
    return m;
  }, [constraints]);

  return {
    constraints,
    byId,
    loading,
    error,
    refetch: fetchConstraints,
    createConstraint,
  };
}
