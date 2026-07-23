import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../lib/api.ts';
import type { TrainingNote, TrainingNotesResponse } from '../types/api.ts';

export function useTrainingNotes() {
  const [allNotes, setAllNotes] = useState<TrainingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch all notes once (no server-side search — client filters instantly)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<TrainingNotesResponse>('/api/notes')
      .then(res => { if (!cancelled) setAllNotes(res.notes ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  const search = useCallback((query: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(query), 150);
  }, []);

  // Client-side filter — instant, no network latency
  const notes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allNotes;
    return allNotes.filter(n =>
      n.text.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [allNotes, searchQuery]);

  return { notes, loading, refetch, search, searchQuery };
}
