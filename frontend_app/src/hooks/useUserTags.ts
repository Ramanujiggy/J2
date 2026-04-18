// useUserTags — manages the user's personal tag library.
// Provides CRUD operations and a stable list, optimistically updated on mutations.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api.ts';
import type { UserTag, UserTagsResponse, Pillar } from '../types/api.ts';

interface CreateTagInput {
  name: string;
  parent_pillar: Pillar;
}

interface CreateTagResponse {
  tag: UserTag;
}

export function useUserTags() {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get<UserTagsResponse>('/api/user-tags');
      setTags(res.tags ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTags(); }, [fetchTags]);

  const createTag = useCallback(async (input: CreateTagInput): Promise<UserTag | null> => {
    try {
      const res = await api.post<CreateTagResponse>('/api/user-tags', input);
      // Replace if it already existed (idempotent endpoint), else prepend
      setTags(prev => {
        const without = prev.filter(t => t.id !== res.tag.id);
        return [...without, res.tag].sort((a, b) => a.name.localeCompare(b.name));
      });
      return res.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
      return null;
    }
  }, []);

  const tagsByPillar = useMemo(() => {
    const grouped: Record<string, UserTag[]> = {};
    for (const t of tags) {
      (grouped[t.parent_pillar] ??= []).push(t);
    }
    return grouped;
  }, [tags]);

  return { tags, tagsByPillar, loading, error, refetch: fetchTags, createTag };
}
