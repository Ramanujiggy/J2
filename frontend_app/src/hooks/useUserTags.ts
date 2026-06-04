// useUserTags — manages the user's personal tag library.
// Provides CRUD operations and a stable list, optimistically updated on mutations.
//
// Move Library: also provides attachVideo() — a single high-level helper that
// validates a file, extracts a thumbnail, saves the blob locally, and PATCHes
// the metadata to the server in one transactional operation.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api.ts';
import type { UserTag, UserTagsResponse, UserTagVideoUpdate, Pillar, Affinity } from '../types/api.ts';
import { deleteVideosForTag, hasQuotaFor } from '../lib/videoStore.ts';
import { validateVideoFile, probeVideo, extractThumbnail } from '../lib/videoUtils.ts';
import { uploadToR2, type UploadProgressCallback } from '../lib/videoUploader.ts';

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
   * Full "attach a video to a tag" flow (Move Library v2, mig 028).
   *
   *   1. Validate file (size, type) — client-side guard
   *   2. Probe duration + dimensions — for the metadata payload
   *   3. Check local-storage quota — for the OPFS cache (best-effort)
   *   4. Extract thumbnail — sent to server so the Pokedex has something
   *      to render during the encode (which can take 15-30 seconds)
   *   5. Server: mint a 5-min signed PUT URL → response includes the
   *      storage key the server expects to see in upload-complete
   *   6. PUT the raw bytes directly to R2 (no backend proxy). XHR with
   *      progress callback drives the "Saving N%…" UI.
   *   7. Server: upload-complete records metadata + flips status to
   *      'processing'. Worker picks up from there asynchronously.
   *   8. Best-effort write to OPFS so the next playback has a fast path.
   *      Never fatal — cloud is the source of truth.
   *
   * Returns the updated tag (with video_status='processing') on success,
   * null on any failure with `error` set.
   *
   * The optional onProgress callback receives byte/percent updates during
   * step 6. The TechniquePage VideoBlock uses this to render "Saving 47%…".
   */
  const attachVideo = useCallback(async (
    id: string,
    file: File,
    onProgress?: UploadProgressCallback,
  ): Promise<UserTag | null> => {
    try {
      // 1. Pre-flight validation
      const validation = validateVideoFile(file);
      if (!validation.valid) {
        setError(validation.reason ?? 'Invalid video file.');
        return null;
      }

      // 2. Probe duration + dimensions
      const probe = await probeVideo(file);

      // 3. Local-storage quota check (best-effort cache later; not fatal here)
      // We still check so we don't surprise the user with a "cache write
      // failed" warning later. If quota is tight we just skip the cache.
      const localOk = await hasQuotaFor(file.size);

      // 4. Extract thumbnail — small JPEG sent to server in upload-complete
      const thumbnail = await extractThumbnail(file);

      // 5. Mint a signed upload URL for this specific tag.
      // Derive an extension from the file name (or MIME) so the storage key
      // is legible in R2's web UI when debugging.
      const extFromName = file.name.includes('.') ? file.name.split('.').pop() : null;
      const ext = (extFromName || (file.type.split('/')[1] ?? 'bin')).toLowerCase().slice(0, 8);

      const sig = await api.post<{ uploadUrl: string; storageKey: string; expiresAt: string }>(
        `/api/user-tags/${id}/video/upload-url`,
        { content_type: file.type || 'video/mp4', ext },
      );

      // 6. PUT bytes to R2 directly with progress reporting
      await uploadToR2(sig.uploadUrl, file, file.type || 'video/mp4', onProgress);

      // 7. Server: record + flip to processing. Returns the updated tag.
      const completed = await api.post<{ tag: UserTag }>(
        `/api/user-tags/${id}/video/upload-complete`,
        {
          raw_storage_key: sig.storageKey,
          byte_size: file.size,
          video_thumbnail: thumbnail,
          video_duration_seconds: Math.round(probe.durationSeconds),
        },
      );

      // Optimistic local-state update so the Pokedex flips immediately
      // without waiting for the next refetch.
      setTags(prev => prev.map(t => (t.id === completed.tag.id ? completed.tag : t)));
      setError(null);

      // We deliberately do NOT cache the raw file locally here. The raw
      // file's byte size doesn't match the encoded variant's byte size
      // (the worker re-encodes to H.264/AAC + scale-1080p), and the
      // playback cache key is derived from the server's encoded
      // video_byte_size. Caching the raw under any composite key would
      // either never be found (size mismatch) or would serve stale
      // content across re-uploads. The first playback after upload pays a
      // ~1-3s fetch cost; everything afterwards is local + correctly
      // invalidated.
      void localOk;

      return completed.tag;
    } catch (err) {
      // Recognise abort silently — the user backed out, not an error.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      setError(err instanceof Error ? err.message : 'Failed to attach video.');
      return null;
    }
  }, []);

  /**
   * Re-queue a transcode that previously failed. Server keeps the raw
   * upload around so the worker just re-runs ffmpeg — no re-upload needed.
   */
  const retryEncode = useCallback(async (id: string): Promise<UserTag | null> => {
    try {
      const res = await api.post<{ tag: UserTag }>(`/api/user-tags/${id}/video/retry`, {});
      setTags(prev => prev.map(t => (t.id === res.tag.id ? res.tag : t)));
      setError(null);
      return res.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry encode.');
      return null;
    }
  }, []);

  /**
   * Detach a video from a tag entirely. Hits the new mig-028 endpoint
   * which clears DB state + best-effort R2 cleanup. Local OPFS cache is
   * cleared on the client side.
   */
  const detachVideo = useCallback(async (id: string): Promise<UserTag | null> => {
    try {
      // Best-effort local cache clear — sweep every cached variant for
      // this tag (composite keys + the legacy unversioned key).
      try { await deleteVideosForTag(id); } catch { /* ignore */ }
      const res = await api.delete<{ tag: UserTag }>(`/api/user-tags/${id}/video`);
      setTags(prev => prev.map(t => (t.id === res.tag.id ? res.tag : t)));
      setError(null);
      return res.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove video.');
      return null;
    }
  }, []);

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
    // Move Library v2 (migration 028)
    retryEncode,
  };
}
