import { query } from '../config/db.js';
import { getCanonicalPositionById } from './canonicalPositionModel.js';

export type Affinity = 'go_to' | 'learning' | 'shelved';
export type VideoStatus = 'processing' | 'ready' | 'failed';

export interface UserTag {
  id: string;
  user_id: string;
  name: string;
  parent_pillar: 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';
  aliases: string[];                     // migration 012 — user-owned aliases for typeahead
  created_at: Date;
  // Move Library (migration 010) — thumbnail + duration metadata sync; the
  // actual bytes live in R2 starting with mig 028 (was OPFS-only pre-028).
  has_video?: boolean;
  video_thumbnail?: string | null;       // data URL (~10KB JPEG, client-extracted)
  video_duration_seconds?: number | null;
  video_notes?: string | null;
  // Technique Library v1 (migration 027) — personal judgement + memory book
  affinity?: Affinity | null;
  resonance_journal?: string | null;
  // Move Library v2 (migration 028) — cloud storage + transcoding
  video_status?: VideoStatus | null;             // null = no video; otherwise lifecycle state
  video_storage_key?: string | null;             // encoded MP4 in R2 (set when ready)
  video_raw_storage_key?: string | null;         // raw upload in R2 (cleaned post-encode)
  video_byte_size?: number | null;               // size of encoded variant
  video_status_message?: string | null;          // error info when status='failed'
  video_processing_started_at?: Date | null;     // worker claim guard (15-min stale-claim TTL)
}

/**
 * Patch the video metadata for a user_tag (Move Library).
 * Only updates fields explicitly passed (undefined = leave unchanged).
 * Pass null to clear a field.
 */
export const updateUserTagVideo = async (
  userId: string,
  id: string,
  patch: {
    has_video?: boolean;
    video_thumbnail?: string | null;
    video_duration_seconds?: number | null;
    video_notes?: string | null;
  },
): Promise<UserTag | null> => {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (patch.has_video !== undefined) {
    fields.push(`has_video = $${i++}`);
    params.push(patch.has_video);
  }
  if (patch.video_thumbnail !== undefined) {
    fields.push(`video_thumbnail = $${i++}`);
    params.push(patch.video_thumbnail);
  }
  if (patch.video_duration_seconds !== undefined) {
    fields.push(`video_duration_seconds = $${i++}`);
    params.push(patch.video_duration_seconds);
  }
  if (patch.video_notes !== undefined) {
    fields.push(`video_notes = $${i++}`);
    params.push(patch.video_notes);
  }
  if (fields.length === 0) return null;

  params.push(id, userId);
  const result = await query(
    `UPDATE user_tags SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
};

export const getUserTags = async (userId: string): Promise<UserTag[]> => {
  const result = await query(
    `SELECT * FROM user_tags WHERE user_id = $1 ORDER BY name ASC`,
    [userId],
  );
  return result.rows;
};

export const getUserTagsByIds = async (userId: string, ids: string[]): Promise<UserTag[]> => {
  if (ids.length === 0) return [];
  const result = await query(
    `SELECT * FROM user_tags WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, ids],
  );
  return result.rows;
};

/**
 * Lookup by id, scoped to the owning user. Returns null when not found OR
 * when the row exists but belongs to a different user — the same surface
 * regardless, so the caller's "Tag not found." error message is
 * deniability-preserving for cross-user lookups.
 */
export const findUserTagById = async (userId: string, id: string): Promise<UserTag | null> => {
  const result = await query(
    `SELECT * FROM user_tags WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return result.rows[0] ?? null;
};

export const findUserTagByName = async (userId: string, name: string): Promise<UserTag | null> => {
  const result = await query(
    `SELECT * FROM user_tags WHERE user_id = $1 AND name = $2`,
    [userId, name],
  );
  return result.rows[0] ?? null;
};

/**
 * Idempotent create: if a tag with this (user_id, name) already exists,
 * returns the existing row unchanged. Atomic — safe under concurrent calls.
 *
 * The dummy `DO UPDATE SET name = EXCLUDED.name` is a no-op that exists only
 * to make ON CONFLICT return the existing row via RETURNING. PG's ON CONFLICT
 * DO NOTHING does NOT return rows, which is why we need the no-op update.
 *
 * Returns the row + a `created` boolean indicating whether it was newly inserted.
 */
export const upsertUserTag = async (
  userId: string,
  name: string,
  parentPillar: string,
): Promise<{ tag: UserTag; created: boolean }> => {
  const result = await query(
    `INSERT INTO user_tags (user_id, name, parent_pillar)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *, (xmax = 0) AS created`,
    [userId, name, parentPillar],
  );
  const row = result.rows[0];
  // Postgres exposes xmax as 0 on freshly-inserted rows and the txn id of the
  // updating txn on conflicts. Pulling it via `(xmax = 0)` lets us distinguish
  // create from no-op upsert without a second query.
  return { tag: row, created: row.created === true };
};

export const updateUserTag = async (
  userId: string,
  id: string,
  name: string | null,
  parentPillar: string | null,
): Promise<UserTag | null> => {
  // Build dynamic update — only update fields that are provided
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (name !== null) { fields.push(`name = $${i++}`); params.push(name); }
  if (parentPillar !== null) { fields.push(`parent_pillar = $${i++}`); params.push(parentPillar); }
  if (fields.length === 0) return null;

  params.push(id, userId);
  const result = await query(
    `UPDATE user_tags SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
};

/**
 * Set the user's affinity for a technique (migration 027). Pass null to clear.
 * Returns the updated row, or null when the tag isn't found / not owned.
 */
export const setAffinity = async (
  userId: string,
  id: string,
  affinity: Affinity | null,
): Promise<UserTag | null> => {
  const result = await query(
    `UPDATE user_tags SET affinity = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [affinity, id, userId],
  );
  return result.rows[0] ?? null;
};

/**
 * Set the cumulative resonance journal for a technique (migration 027).
 * Pass null or empty string to clear. Returns the updated row, or null
 * when the tag isn't found / not owned.
 */
export const setResonanceJournal = async (
  userId: string,
  id: string,
  journal: string | null,
): Promise<UserTag | null> => {
  // Treat empty string as null so the DB stays consistent and the column
  // either has meaningful prose or is genuinely empty.
  const value = journal && journal.trim().length > 0 ? journal : null;
  const result = await query(
    `UPDATE user_tags SET resonance_journal = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [value, id, userId],
  );
  return result.rows[0] ?? null;
};

/**
 * Promote a canonical position into a personal user_tag (migration 027).
 *
 * Idempotent: if a user_tag with the canonical's name already exists for the
 * user, returns the existing row unchanged via `upsertUserTag`'s ON CONFLICT
 * path. Safe under concurrent calls; the existing (user_id, name) UNIQUE
 * constraint prevents duplicates at the DB layer.
 *
 * Returns:
 *   - { tag, created: true }  — fresh fork
 *   - { tag, created: false } — already existed, returned untouched
 *   - null                    — canonical_position_id doesn't exist
 */
export const promoteCanonicalToUserTag = async (
  userId: string,
  canonicalId: string,
): Promise<{ tag: UserTag; created: boolean } | null> => {
  const canonical = await getCanonicalPositionById(canonicalId);
  if (!canonical) return null;
  return upsertUserTag(userId, canonical.name, canonical.parent_pillar);
};

export const deleteUserTag = async (userId: string, id: string): Promise<boolean> => {
  // Note: this leaves orphan IDs in training_sessions.user_tag_ids arrays.
  // The frontend filters them out when displaying. Could clean up with a UPDATE
  // statement using array_remove if needed.
  const result = await query(
    `DELETE FROM user_tags WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// Move Library v2 — cloud storage + transcoding (migration 028)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called from `POST /api/user-tags/:id/video/upload-complete` after the client
 * has PUT the raw bytes to R2. Records all the metadata in one round trip and
 * flips status to 'processing' so the transcode worker can claim the job.
 *
 * Also writes the client-extracted thumbnail + duration here so the Pokedex
 * has something to render during the encode (which can take 15-30 seconds).
 */
export const recordRawUpload = async (
  userId: string,
  id: string,
  patch: {
    raw_storage_key: string;
    byte_size: number;
    video_thumbnail: string | null;
    video_duration_seconds: number | null;
  },
): Promise<UserTag | null> => {
  const result = await query(
    `UPDATE user_tags
        SET has_video = TRUE,
            video_status = 'processing',
            video_raw_storage_key = $1,
            video_byte_size = $2,
            video_thumbnail = $3,
            video_duration_seconds = $4,
            video_storage_key = NULL,         -- cleared until encode succeeds
            video_status_message = NULL,
            video_processing_started_at = NULL
      WHERE id = $5 AND user_id = $6
      RETURNING *`,
    [
      patch.raw_storage_key,
      patch.byte_size,
      patch.video_thumbnail,
      patch.video_duration_seconds,
      id,
      userId,
    ],
  );
  return result.rows[0] ?? null;
};

/**
 * Claim the next pending transcode job for the worker. Uses FOR UPDATE SKIP
 * LOCKED so multiple workers (or a worker restart) never grab the same job.
 *
 * The stale-claim guard (`< NOW() - INTERVAL '15 minutes'`) lets us reclaim
 * a job whose worker died mid-encode without manual intervention. 15 min is
 * generous — a 60s clip encodes in 15-30s on Railway-class CPU.
 *
 * Sets `video_processing_started_at = NOW()` on the claimed row so a parallel
 * worker can't claim it again. Returns null when there's nothing to do.
 */
export const claimNextTranscodeJob = async (): Promise<UserTag | null> => {
  const result = await query(
    `UPDATE user_tags
        SET video_processing_started_at = NOW()
      WHERE id = (
        SELECT id FROM user_tags
         WHERE video_status = 'processing'
           AND video_raw_storage_key IS NOT NULL
           AND (
             video_processing_started_at IS NULL
             OR video_processing_started_at < NOW() - INTERVAL '15 minutes'
           )
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING *`,
  );
  return result.rows[0] ?? null;
};

/**
 * Worker calls this on successful encode. Flips status to 'ready', records
 * the encoded storage key + final byte size, clears the raw key (the worker
 * has already deleted the raw object from R2 by the time it calls this).
 */
export const markTranscodeReady = async (
  id: string,
  encoded_storage_key: string,
  encoded_byte_size: number,
): Promise<UserTag | null> => {
  const result = await query(
    `UPDATE user_tags
        SET video_status = 'ready',
            video_storage_key = $1,
            video_byte_size = $2,
            video_raw_storage_key = NULL,
            video_status_message = NULL,
            video_processing_started_at = NULL
      WHERE id = $3
      RETURNING *`,
    [encoded_storage_key, encoded_byte_size, id],
  );
  return result.rows[0] ?? null;
};

/**
 * Worker calls this when ffmpeg fails. Status = 'failed', error message
 * captured for the UI. We DON'T clear the raw key — keeping it lets the
 * user retry the encode without re-uploading.
 *
 * Truncates the message at 1000 chars defensively (ffmpeg stderr can be
 * thousands of lines on weird input, and the column has a soft cap).
 */
export const markTranscodeFailed = async (
  id: string,
  reason: string,
): Promise<UserTag | null> => {
  const truncated = reason.length > 1000 ? reason.slice(0, 1000) + '…' : reason;
  const result = await query(
    `UPDATE user_tags
        SET video_status = 'failed',
            video_status_message = $1,
            video_processing_started_at = NULL
      WHERE id = $2
      RETURNING *`,
    [truncated, id],
  );
  return result.rows[0] ?? null;
};

/**
 * Called from the retry path. Flips a 'failed' row back to 'processing'
 * (no re-upload required since the raw is still in R2). Worker picks up
 * on the next tick.
 */
export const requeueFailedTranscode = async (
  userId: string,
  id: string,
): Promise<UserTag | null> => {
  const result = await query(
    `UPDATE user_tags
        SET video_status = 'processing',
            video_status_message = NULL,
            video_processing_started_at = NULL
      WHERE id = $1
        AND user_id = $2
        AND video_status = 'failed'
        AND video_raw_storage_key IS NOT NULL
      RETURNING *`,
    [id, userId],
  );
  return result.rows[0] ?? null;
};

/**
 * Clear all video state on a tag. Used by the user-facing "Remove video"
 * action AND by detach paths. Returns the storage keys (raw + encoded) that
 * existed BEFORE the clear so the caller can issue R2 DELETE calls. The DB
 * is the source of truth — we wipe it first, then clean R2 best-effort
 * (orphan R2 objects are safer than dangling DB references).
 */
export const clearVideo = async (
  userId: string,
  id: string,
): Promise<{ tag: UserTag; rawKey: string | null; encodedKey: string | null } | null> => {
  // SELECT first so we can return the previous storage keys to the caller
  // (they need them to issue R2 DELETE calls). RETURNING on the UPDATE would
  // give us the post-clear values — too late.
  const select = await query(
    `SELECT video_storage_key, video_raw_storage_key
       FROM user_tags
      WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (select.rows.length === 0) return null;
  const rawKey = select.rows[0].video_raw_storage_key as string | null;
  const encodedKey = select.rows[0].video_storage_key as string | null;

  const update = await query(
    `UPDATE user_tags
        SET has_video = FALSE,
            video_status = NULL,
            video_storage_key = NULL,
            video_raw_storage_key = NULL,
            video_byte_size = NULL,
            video_status_message = NULL,
            video_processing_started_at = NULL,
            video_thumbnail = NULL,
            video_duration_seconds = NULL,
            video_notes = NULL
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
    [id, userId],
  );
  if (update.rows.length === 0) return null;

  return {
    tag: update.rows[0] as UserTag,
    rawKey,
    encodedKey,
  };
};
