import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api.ts';
import type { TrainingNote, TrainingNotesResponse } from '../types/api.ts';

export function useTrainingNotes() {
  const [notes, setNotes] = useState<TrainingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchKey, setFetchKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
    api.get<TrainingNotesResponse>(`/api/notes${params}`)
      .then(res => { if (!cancelled) setNotes(res.notes ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey, searchQuery]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  const search = useCallback((query: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(query), 300);
  }, []);

  return { notes, loading, refetch, search, searchQuery };
}
