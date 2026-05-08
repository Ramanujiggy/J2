// useUserTags — manages the user's personal tag library.
// Provides CRUD operations and a stable list, optimistically updated on mutations.
//
// Move Library: also provides attachVideo() — a single high-level helper that
// validates a file, extracts a thumbnail, saves the blob locally, and PATCHes
// the metadata to the server in one transactional operation.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api.ts';
import type { UserTag, UserTagsResponse, UserTagVideoUpdate, Pillar, Affinity } from '../types/api.ts';
import { saveVideo, deleteVideo, hasQuotaFor } from '../lib/videoStore.ts';
import { validateVideoFile, probeVideo, extractThumbnail } from '../lib/videoUtils.ts';

interface CreateTagInput {
  name: string;
  parent_pillar: Pillar;
}

interface CreateTagResponse {
  tag: UserTag;
}

interface UpdateVideoResponse {
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
      setError(null);
      return res.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
      return null;
    }
  }, []);

  /**
   * Patch a tag's video metadata on the server. Used after local-store ops.
   * Use attachVideo() / detachVideo() for the full flow (recommended).
   */
  const patchVideoMeta = useCallback(async (id: string, patch: UserTagVideoUpdate): Promise<UserTag | null> => {
    try {
      const res = await api.patch<UpdateVideoResponse>(`/api/user-tags/${id}/video`, patch);
      setTags(prev => prev.map(t => t.id === res.tag.id ? res.tag : t));
      setError(null);
      return res.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update video metadata');
      return null;
    }
  }, []);

  /**
   * Full "attach a video to a tag" flow:
   *   1. Validate file (size, type)
   *   2. Probe duration + dimensions
   *   3. Check local storage quota
   *   4. Extract thumbnail
   *   5. Save blob locally (OPFS / IndexedDB)
   *   6. PATCH metadata to server
   *
   * Returns the updated tag on success, null on any failure (with `error` set).
   */
  const attachVideo = useCallback(async (id: string, file: File, notes?: string): Promise<UserTag | null> => {
    try {
      const validation = validateVideoFile(file);
      if (!validation.valid) {
        setError(validation.reason ?? 'Invalid video file.');
        return null;
      }

      const probe = await probeVideo(file);

      const ok = await hasQuotaFor(file.size);
      if (!ok) {
        setError(`Not enough local storage for this clip. Free some space (or delete an existing clip).`);
        return null;
      }

      const thumbnail = await extractThumbnail(file);
      await saveVideo(id, file);

      return await patchVideoMeta(id, {
        has_video: true,
        video_thumbnail: thumbnail,
        video_duration_seconds: Math.round(probe.durationSeconds),
        video_notes: notes ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach video.');
      return null;
    }
  }, [patchVideoMeta]);

  /** Detach: removes local blob AND clears server metadata. */
  const detachVideo = useCallback(async (id: string): Promise<UserTag | null> => {
    try {
      await deleteVideo(id);
      return await patchVideoMeta(id, {
        has_video: false,
        video_thumbnail: null,
        video_duration_seconds: null,
        video_notes: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove video.');
      return null;
    }
  }, [patchVideoMeta]);

  /**
   * Update affinity / resonance_journal on a tag (migration 027). Optimistically
   * patches local state; on failure, refetches to reconcile. Pass `affinity: null`
   * or `resonance_journal: null` to clear.
   */
  const patchTag = useCallback(async (
    id: string,
    patch: { affinity?: Affinity | null; resonance_journal?: string | null },
  ): Promise<UserTag | null> => {
    // Optimistic local update so the UI never feels laggy.
    setTags(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const res = await api.patch<{ tag: UserTag }>(`/api/user-tags/${id}`, patch);
      setTags(prev => prev.map(t => (t.id === res.tag.id ? res.tag : t)));
      setError(null);
      return res.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
      void fetchTags(); // reconcile from server
      return null;
    }
  }, [fetchTags]);

  /** Set the user's affinity for a technique. Pass null to clear. */
  const setAffinity = useCallback((id: string, affinity: Affinity | null) =>
    patchTag(id, { affinity }), [patchTag]);

  /** Set the cumulative resonance journal for a technique. Empty/null clears. */
  const setResonance = useCallback((id: string, resonance_journal: string | null) =>
    patchTag(id, { resonance_journal }), [patchTag]);

  /**
   * Pick a canonical position as if it were one of the user's own tags. Silently
   * forks the canonical row into a personal user_tag (idempotent — re-calling
   * with the same canonical id returns the existing fork). Returns the user_tag
   * id so the caller can drop it into `selectedUserTagIds` cleanly.
   *
   * Migration 027 — see `promoteCanonicalToUserTag` in userTagModel + the
   * `POST /api/user-tags/promote-canonical` endpoint.
   */
  const selectCanonicalAsUserTag = useCallback(async (canonicalId: string): Promise<string | null> => {
    try {
      const res = await api.post<{ tag: UserTag; created: boolean }>(
        '/api/user-tags/promote-canonical',
        { canonical_position_id: canonicalId },
      );
      // Splice the new (or existing) tag into the local list so the picker
      // immediately shows it on subsequent renders.
      setTags(prev => {
        const without = prev.filter(t => t.id !== res.tag.id);
        return [...without, res.tag].sort((a, b) => a.name.localeCompare(b.name));
      });
      setError(null);
      return res.tag.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add technique to your library');
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

  const byId = useMemo(() => {
    const m = new Map<string, UserTag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  return {
    tags,
    tagsByPillar,
    byId,
    loading,
    error,
    refetch: fetchTags,
    createTag,
    attachVideo,
    detachVideo,
    patchVideoMeta,
    // Technique Library v1 (migration 027)
    setAffinity,
    setResonance,
    selectCanonicalAsUserTag,
  };
}
