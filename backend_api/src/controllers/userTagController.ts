import type { Request, Response } from 'express';
import * as userTagModel from '../models/userTagModel.js';
import type { Affinity } from '../models/userTagModel.js';
import * as r2 from '../lib/r2Client.js';

const VALID_PILLARS = new Set(['standup', 'passing', 'pins', 'submissions', 'guard']);
const VALID_AFFINITIES = new Set<Affinity>(['go_to', 'learning', 'shelved']);
const MAX_RESONANCE_JOURNAL_LENGTH = 5000;
// 50MB cap on a single video upload — enforced at the signed-URL handshake
// stage AND validated again at upload-complete via the byte-size payload.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
// Whitelist of MIME types we'll accept — clients should be sending video/*
// (iOS Safari → video/quicktime for HEVC, video/mp4 from most other paths).
const ACCEPTED_VIDEO_PREFIXES = ['video/'];

function validateName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 50) return null;
  return trimmed;
}

// GET /api/user-tags — list all tags for the current user
export const getUserTags = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tags = await userTagModel.getUserTags(userId);
    res.status(200).json({ tags });
  } catch (error) {
    console.error('❌ Error fetching user tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/user-tags — create a new tag, or return existing on name conflict.
// Idempotent and atomic: concurrent calls with the same name resolve to the
// same row (no race condition between exists-check and insert).
// Body: { name: string, parent_pillar: string }
export const createUserTag = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, parent_pillar } = req.body;

    const cleanName = validateName(name);
    if (!cleanName) {
      return res.status(400).json({ message: 'name must be a string between 1 and 50 characters.' });
    }
    if (!VALID_PILLARS.has(parent_pillar)) {
      return res.status(400).json({ message: 'parent_pillar must be a valid pillar.' });
    }

    const { tag, created } = await userTagModel.upsertUserTag(userId, cleanName, parent_pillar);
    res.status(created ? 201 : 200).json({ tag });
  } catch (error) {
    console.error('❌ Error creating user tag:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/user-tags/:id — update name, parent_pillar, affinity, and/or
// resonance_journal in a single request. Each field is independently optional;
// only those present in the body are touched.
//
// Body: {
//   name?: string,
//   parent_pillar?: 'standup' | 'passing' | 'pins' | 'submissions' | 'guard',
//   affinity?: 'go_to' | 'learning' | 'shelved' | null,    // null clears
//   resonance_journal?: string | null,                     // null/empty clears
// }
//
// Affinity + resonance_journal additions land in migration 027 (Technique Library v1).
export const updateUserTag = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });
    const { name, parent_pillar, affinity, resonance_journal } = req.body;

    let cleanName: string | null = null;
    if (name !== undefined) {
      cleanName = validateName(name);
      if (!cleanName) {
        return res.status(400).json({ message: 'name must be a string between 1 and 50 characters.' });
      }
    }

    let cleanPillar: string | null = null;
    if (parent_pillar !== undefined) {
      if (!VALID_PILLARS.has(parent_pillar)) {
        return res.status(400).json({ message: 'parent_pillar must be a valid pillar.' });
      }
      cleanPillar = parent_pillar;
    }

    let cleanAffinity: Affinity | null | undefined; // undefined = don't touch; null = clear
    if (affinity !== undefined) {
      if (affinity !== null && !VALID_AFFINITIES.has(affinity)) {
        return res.status(400).json({ message: "affinity must be 'go_to', 'learning', 'shelved', or null." });
      }
      cleanAffinity = affinity;
    }

    let cleanJournal: string | null | undefined;
    if (resonance_journal !== undefined) {
      if (resonance_journal !== null) {
        if (typeof resonance_journal !== 'string') {
          return res.status(400).json({ message: 'resonance_journal must be a string or null.' });
        }
        if (resonance_journal.length > MAX_RESONANCE_JOURNAL_LENGTH) {
          return res.status(400).json({ message: `resonance_journal must be ≤ ${MAX_RESONANCE_JOURNAL_LENGTH} characters.` });
        }
      }
      cleanJournal = resonance_journal;
    }

    // Require at least one field to update — otherwise the request is a no-op
    // and the previous behaviour (return 404 from the model) is misleading.
    if (cleanName === null && cleanPillar === null && cleanAffinity === undefined && cleanJournal === undefined) {
      return res.status(400).json({ message: 'No updatable fields provided.' });
    }

    // Apply each touch in sequence. Each model fn returns the updated row,
    // and the last one wins as the response — they all touch the same row
    // so the final value reflects every applied patch.
    let tag: userTagModel.UserTag | null = null;

    if (cleanName !== null || cleanPillar !== null) {
      tag = await userTagModel.updateUserTag(userId, id, cleanName, cleanPillar);
      if (!tag) return res.status(404).json({ message: 'Tag not found.' });
    }
    if (cleanAffinity !== undefined) {
      tag = await userTagModel.setAffinity(userId, id, cleanAffinity);
      if (!tag) return res.status(404).json({ message: 'Tag not found.' });
    }
    if (cleanJournal !== undefined) {
      tag = await userTagModel.setResonanceJournal(userId, id, cleanJournal);
      if (!tag) return res.status(404).json({ message: 'Tag not found.' });
    }

    res.status(200).json({ tag });
  } catch (error) {
    console.error('❌ Error updating user tag:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/user-tags/promote-canonical — silently fork a canonical position
// into a personal user_tag so personal data (affinity / resonance / video)
// has somewhere to live (migration 027). Idempotent: re-calling with the
// same canonical id returns the existing row.
//
// Body: { canonical_position_id: string (uuid) }
// Response: { tag: UserTag, created: boolean }
//   - 201 + created:true on first promote
//   - 200 + created:false on subsequent calls (already forked)
//   - 404 when the canonical id doesn't exist
export const promoteCanonicalToUserTag = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { canonical_position_id } = req.body ?? {};
    if (typeof canonical_position_id !== 'string' || canonical_position_id.length < 1) {
      return res.status(400).json({ message: 'canonical_position_id (string uuid) is required.' });
    }

    const result = await userTagModel.promoteCanonicalToUserTag(userId, canonical_position_id);
    if (!result) {
      return res.status(404).json({ message: 'Canonical position not found.' });
    }

    res.status(result.created ? 201 : 200).json({ tag: result.tag, created: result.created });
  } catch (error) {
    console.error('❌ Error promoting canonical to user tag:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/user-tags/:id/video — update video metadata (Move Library, migration 010)
// The actual video file is stored client-side (OPFS / IndexedDB) — this endpoint
// only persists the small thumbnail + duration + notes that should sync.
// Body: { has_video?, video_thumbnail?, video_duration_seconds?, video_notes? }
//   - any field omitted is left unchanged
//   - any field passed as null clears it (e.g. removing video clears thumbnail)
const MAX_THUMBNAIL_BYTES = 32 * 1024; // ~32KB cap on data URL string
const MAX_VIDEO_NOTES_LENGTH = 1000;
const MAX_VIDEO_DURATION_SECONDS = 600;

export const updateUserTagVideo = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });

    const { has_video, video_thumbnail, video_duration_seconds, video_notes } = req.body;
    const patch: Parameters<typeof userTagModel.updateUserTagVideo>[2] = {};

    if (has_video !== undefined) {
      if (typeof has_video !== 'boolean') {
        return res.status(400).json({ message: 'has_video must be a boolean.' });
      }
      patch.has_video = has_video;
    }

    if (video_thumbnail !== undefined) {
      if (video_thumbnail !== null) {
        if (typeof video_thumbnail !== 'string') {
          return res.status(400).json({ message: 'video_thumbnail must be a data URL string or null.' });
        }
        if (video_thumbnail.length > MAX_THUMBNAIL_BYTES) {
          return res.status(400).json({ message: `video_thumbnail must be ≤ ${MAX_THUMBNAIL_BYTES} bytes (got ${video_thumbnail.length}).` });
        }
        if (!video_thumbnail.startsWith('data:image/')) {
          return res.status(400).json({ message: 'video_thumbnail must be a data:image/* URL.' });
        }
      }
      patch.video_thumbnail = video_thumbnail;
    }

    if (video_duration_seconds !== undefined) {
      if (video_duration_seconds !== null) {
        const n = Number(video_duration_seconds);
        if (!Number.isFinite(n) || n < 0 || n > MAX_VIDEO_DURATION_SECONDS) {
          return res.status(400).json({ message: `video_duration_seconds must be between 0 and ${MAX_VIDEO_DURATION_SECONDS}.` });
        }
        patch.video_duration_seconds = Math.round(n);
      } else {
        patch.video_duration_seconds = null;
      }
    }

    if (video_notes !== undefined) {
      if (video_notes !== null) {
        if (typeof video_notes !== 'string') {
          return res.status(400).json({ message: 'video_notes must be a string or null.' });
        }
        if (video_notes.length > MAX_VIDEO_NOTES_LENGTH) {
          return res.status(400).json({ message: `video_notes must be ≤ ${MAX_VIDEO_NOTES_LENGTH} characters.` });
        }
      }
      patch.video_notes = video_notes;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No video fields provided.' });
    }

    const tag = await userTagModel.updateUserTagVideo(userId, id, patch);
    if (!tag) return res.status(404).json({ message: 'Tag not found.' });
    res.status(200).json({ tag });
  } catch (error) {
    console.error('❌ Error updating user tag video:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/user-tags/:id
export const deleteUserTag = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });
    const ok = await userTagModel.deleteUserTag(userId, id);
    if (!ok) return res.status(404).json({ message: 'Tag not found.' });
    res.status(200).json({ message: 'Tag deleted.' });
  } catch (error) {
    console.error('❌ Error deleting user tag:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Move Library v2 — cloud video endpoints (migration 028)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/user-tags/:id/video/upload-url
 *
 * Mint a 5-minute signed PUT URL so the client can upload raw video bytes
 * directly to R2 (no backend proxy). The DB is NOT updated here — only after
 * the client confirms the upload via /upload-complete. This means a leaked
 * signed URL can't claim a row.
 *
 * Body: { content_type: string, ext: string }
 *   content_type — typically "video/quicktime" (iOS HEVC) or "video/mp4"
 *   ext          — file extension (used in the storage key for legibility)
 *
 * Response: { uploadUrl, storageKey, expiresAt }
 */
export const mintVideoUploadUrl = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });

    const { content_type, ext } = req.body ?? {};
    if (typeof content_type !== 'string' || !ACCEPTED_VIDEO_PREFIXES.some(p => content_type.startsWith(p))) {
      return res.status(400).json({ message: 'content_type must be a video/* MIME type.' });
    }
    if (typeof ext !== 'string' || ext.length < 1 || ext.length > 8) {
      return res.status(400).json({ message: 'ext must be a short file extension string.' });
    }

    // Verify the tag exists + belongs to the user before signing.
    const tag = await userTagModel.findUserTagById(userId, id);
    if (!tag) return res.status(404).json({ message: 'Tag not found.' });

    const storageKey = r2.rawStorageKey(userId, id, ext);
    const { uploadUrl, expiresAt } = await r2.mintPutUrl(storageKey, content_type);

    res.status(200).json({ uploadUrl, storageKey, expiresAt });
  } catch (error) {
    console.error('❌ Error minting upload URL:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/user-tags/:id/video/upload-complete
 *
 * Client calls this AFTER the direct PUT to R2 succeeds. We record the raw
 * key + size + thumbnail + duration + flip status to 'processing'. The
 * transcode worker picks up from there.
 *
 * Body: {
 *   raw_storage_key: string,           // exact key returned by /upload-url
 *   byte_size: number,                 // raw file size, ≤ MAX_VIDEO_BYTES
 *   video_thumbnail: string | null,    // client-extracted JPEG data URL
 *   video_duration_seconds: number | null,
 * }
 */
export const completeVideoUpload = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });

    const { raw_storage_key, byte_size, video_thumbnail, video_duration_seconds } = req.body ?? {};

    // Defensive ownership check. The signed-URL flow already constrained the
    // upload to a key we generated, but verifying the prefix here defends
    // against a malicious client claiming someone else's row.
    if (typeof raw_storage_key !== 'string' || !r2.verifyKeyOwnedBy(raw_storage_key, userId)) {
      return res.status(400).json({ message: 'Invalid raw_storage_key.' });
    }
    if (typeof byte_size !== 'number' || !Number.isFinite(byte_size) || byte_size <= 0) {
      return res.status(400).json({ message: 'byte_size must be a positive number.' });
    }
    if (byte_size > MAX_VIDEO_BYTES) {
      return res.status(413).json({ message: `Video exceeds ${MAX_VIDEO_BYTES / 1024 / 1024}MB cap.` });
    }
    if (video_thumbnail !== null && typeof video_thumbnail !== 'string') {
      return res.status(400).json({ message: 'video_thumbnail must be a string or null.' });
    }
    if (video_duration_seconds !== null
        && (typeof video_duration_seconds !== 'number' || !Number.isFinite(video_duration_seconds))) {
      return res.status(400).json({ message: 'video_duration_seconds must be a number or null.' });
    }

    const tag = await userTagModel.recordRawUpload(userId, id, {
      raw_storage_key,
      byte_size,
      video_thumbnail: video_thumbnail ?? null,
      video_duration_seconds: video_duration_seconds ?? null,
    });
    if (!tag) return res.status(404).json({ message: 'Tag not found.' });

    res.status(200).json({ tag });
  } catch (error) {
    console.error('❌ Error completing video upload:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/user-tags/:id/video/url
 *
 * Returns the current playback state. When status='ready', includes a 5-min
 * signed GET URL the browser can stream directly from R2. Otherwise returns
 * just the status (the client polls until ready).
 *
 * Response shapes:
 *   { status: 'ready', url, expiresAt }
 *   { status: 'processing' }
 *   { status: 'failed', message }
 *   { status: null }                      // tag has no video
 */
export const getVideoPlaybackUrl = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });

    const tag = await userTagModel.findUserTagById(userId, id);
    if (!tag) return res.status(404).json({ message: 'Tag not found.' });

    const status = tag.video_status ?? null;
    if (status === null || !tag.has_video) {
      return res.status(200).json({ status: null });
    }
    if (status === 'failed') {
      return res.status(200).json({ status: 'failed', message: tag.video_status_message ?? null });
    }
    if (status === 'processing' || !tag.video_storage_key) {
      return res.status(200).json({ status: 'processing' });
    }

    // status === 'ready'
    const { url, expiresAt } = await r2.mintGetUrl(tag.video_storage_key);
    res.status(200).json({ status: 'ready', url, expiresAt });
  } catch (error) {
    console.error('❌ Error minting playback URL:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/user-tags/:id/video/retry
 *
 * Re-queues a failed transcode. Only works on rows whose video_status is
 * currently 'failed' AND that still have a video_raw_storage_key (so the
 * worker has something to re-encode).
 */
export const retryVideoTranscode = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });

    const tag = await userTagModel.requeueFailedTranscode(userId, id);
    if (!tag) {
      return res.status(409).json({
        message: "Can't retry — tag isn't in a failed state, or the raw upload isn't available.",
      });
    }
    res.status(200).json({ tag });
  } catch (error) {
    console.error('❌ Error retrying transcode:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * DELETE /api/user-tags/:id/video
 *
 * Remove the video from a tag entirely. Clears all DB state + best-effort
 * R2 cleanup of both the raw and encoded objects. R2 cleanup failures are
 * logged but not surfaced — the DB is the source of truth, and orphan
 * R2 objects are cheaper than dangling DB references.
 */
export const removeVideo = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });

    const result = await userTagModel.clearVideo(userId, id);
    if (!result) return res.status(404).json({ message: 'Tag not found.' });

    // Best-effort R2 cleanup. Don't await in parallel — errors here shouldn't
    // delay the response or surface to the user.
    void (async () => {
      if (result.rawKey) {
        try { await r2.deleteObject(result.rawKey); }
        catch (err) { console.error(`R2 cleanup failed for raw key ${result.rawKey}:`, err); }
      }
      if (result.encodedKey) {
        try { await r2.deleteObject(result.encodedKey); }
        catch (err) { console.error(`R2 cleanup failed for encoded key ${result.encodedKey}:`, err); }
      }
    })();

    res.status(200).json({ tag: result.tag });
  } catch (error) {
    console.error('❌ Error removing video:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
