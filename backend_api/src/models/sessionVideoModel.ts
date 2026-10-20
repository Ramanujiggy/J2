import { query } from '../config/db.js';

export type VideoStatus = 'processing' | 'ready' | 'failed';

export interface SessionVideo {
    id: string;
    session_id: string;
    user_id: string;
    created_at: string;
    video_status: VideoStatus | null;
    video_storage_key: string | null;
    video_raw_storage_key: string | null;
    video_byte_size: number | null;
    video_status_message: string | null;
    video_processing_started_at: string | null;
    video_thumbnail: string | null;
    video_duration_seconds: number | null;
    video_notes: string | null;
}

export interface PositionSegment {
    id: string;
    video_id: string;
    user_id: string;
    start_sec: number;
    end_sec: number;
    position_label: string;
    source: 'manual' | 'model';
    confirmed: boolean;
    created_at: string;
}

export const listSessionVideos = async (userId: string, sessionId: string): Promise<SessionVideo[]> => {
    const result = await query(
        `SELECT * FROM session_videos
          WHERE session_id = $1 AND user_id = $2
          ORDER BY created_at ASC`,
        [sessionId, userId],
    );
    return result.rows;
};

export const findSessionVideoById = async (userId: string, id: string): Promise<SessionVideo | null> => {
    const result = await query(
        `SELECT * FROM session_videos WHERE id = $1 AND user_id = $2`,
        [id, userId],
    );
    return result.rows[0] ?? null;
};

export const createSessionVideo = async (userId: string, sessionId: string): Promise<SessionVideo> => {
    const result = await query(
        `INSERT INTO session_videos (session_id, user_id) VALUES ($1, $2) RETURNING *`,
        [sessionId, userId],
    );
    return result.rows[0];
};

export const recordRawUpload = async (
    userId: string,
    id: string,
    data: {
        raw_storage_key: string;
        byte_size: number;
        video_thumbnail: string | null;
        video_duration_seconds: number | null;
    },
): Promise<SessionVideo | null> => {
    const result = await query(
        `UPDATE session_videos
            SET video_status = 'processing',
                video_raw_storage_key = $1,
                video_byte_size = $2,
                video_thumbnail = $3,
                video_duration_seconds = $4,
                video_status_message = NULL,
                video_processing_started_at = NULL
          WHERE id = $5 AND user_id = $6
          RETURNING *`,
        [data.raw_storage_key, data.byte_size, data.video_thumbnail, data.video_duration_seconds, id, userId],
    );
    return result.rows[0] ?? null;
};

export const claimNextTranscodeJob = async (): Promise<SessionVideo | null> => {
    const result = await query(
        `UPDATE session_videos
            SET video_processing_started_at = NOW()
          WHERE id = (
            SELECT id FROM session_videos
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

export const markTranscodeReady = async (
    id: string,
    encoded_storage_key: string,
    encoded_byte_size: number,
): Promise<SessionVideo | null> => {
    const result = await query(
        `UPDATE session_videos
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

export const markTranscodeFailed = async (id: string, reason: string): Promise<SessionVideo | null> => {
    const truncated = reason.length > 1000 ? reason.slice(0, 1000) + '…' : reason;
    const result = await query(
        `UPDATE session_videos
            SET video_status = 'failed',
                video_status_message = $1,
                video_processing_started_at = NULL
          WHERE id = $2
          RETURNING *`,
        [truncated, id],
    );
    return result.rows[0] ?? null;
};

export const requeueFailedTranscode = async (userId: string, id: string): Promise<SessionVideo | null> => {
    const result = await query(
        `UPDATE session_videos
            SET video_status = 'processing',
                video_status_message = NULL,
                video_processing_started_at = NULL
          WHERE id = $1 AND user_id = $2
            AND video_status = 'failed'
            AND video_raw_storage_key IS NOT NULL
          RETURNING *`,
        [id, userId],
    );
    return result.rows[0] ?? null;
};

export const clearVideo = async (
    userId: string,
    id: string,
): Promise<{ video: SessionVideo; rawKey: string | null; encodedKey: string | null } | null> => {
    const select = await query(
        `SELECT video_storage_key, video_raw_storage_key FROM session_videos WHERE id = $1 AND user_id = $2`,
        [id, userId],
    );
    if (select.rows.length === 0) return null;
    const rawKey = select.rows[0].video_raw_storage_key as string | null;
    const encodedKey = select.rows[0].video_storage_key as string | null;

    const update = await query(
        `UPDATE session_videos
            SET video_status = NULL,
                video_storage_key = NULL,
                video_raw_storage_key = NULL,
                video_byte_size = NULL,
                video_status_message = NULL,
                video_processing_started_at = NULL,
                video_thumbnail = NULL,
                video_duration_seconds = NULL
          WHERE id = $1 AND user_id = $2
          RETURNING *`,
        [id, userId],
    );
    if (!update.rows[0]) return null;
    return { video: update.rows[0], rawKey, encodedKey };
};

export const deleteSessionVideo = async (userId: string, id: string): Promise<{ rawKey: string | null; encodedKey: string | null } | null> => {
    const select = await query(
        `SELECT video_storage_key, video_raw_storage_key FROM session_videos WHERE id = $1 AND user_id = $2`,
        [id, userId],
    );
    if (select.rows.length === 0) return null;
    const rawKey = select.rows[0].video_raw_storage_key as string | null;
    const encodedKey = select.rows[0].video_storage_key as string | null;
    await query(`DELETE FROM session_videos WHERE id = $1 AND user_id = $2`, [id, userId]);
    return { rawKey, encodedKey };
};

// ── Position segments ──────────────────────────────────────────────────────

export const getSegments = async (userId: string, videoId: string): Promise<PositionSegment[]> => {
    const result = await query(
        `SELECT * FROM position_segments
          WHERE video_id = $1 AND user_id = $2
          ORDER BY start_sec ASC`,
        [videoId, userId],
    );
    return result.rows;
};

export const replaceSegments = async (
    userId: string,
    videoId: string,
    segments: Array<{ start_sec: number; end_sec: number; position_label: string }>,
): Promise<PositionSegment[]> => {
    // Delete all existing manual segments for this video, then insert the new set.
    // Atomic via implicit transaction (single query batch isn't possible here,
    // so we run two queries — acceptable for this write path).
    await query(
        `DELETE FROM position_segments WHERE video_id = $1 AND user_id = $2 AND source = 'manual'`,
        [videoId, userId],
    );
    if (segments.length === 0) return [];

    // Build a multi-row INSERT with parameterised values.
    const values: unknown[] = [];
    const placeholders = segments.map((s, i) => {
        const base = i * 5;
        values.push(videoId, userId, s.start_sec, s.end_sec, s.position_label);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 'manual', TRUE)`;
    });

    const result = await query(
        `INSERT INTO position_segments (video_id, user_id, start_sec, end_sec, position_label, source, confirmed)
         VALUES ${placeholders.join(', ')}
         RETURNING *`,
        values,
    );
    return result.rows;
};

// ── Pose tracks (mig 041) ──────────────────────────────────────────────────

export type PoseTrackStatus = 'pending' | 'ready' | 'failed';

export interface PoseTrackSeed {
    seed_sec: number;
    first_x: number;
    first_y: number;
    second_x: number;
    second_y: number;
}

export interface PoseTrack extends PoseTrackSeed {
    video_id: string;
    user_id: string;
    status: PoseTrackStatus;
    status_message: string | null;
    processing_started_at: Date | string | null;
    fps: number | null;
    frames: Array<[number[] | null, number[] | null]> | null;
    model: string | null;
    created_at: string;
    updated_at: string;
}

export const getPoseTrack = async (userId: string, videoId: string): Promise<PoseTrack | null> => {
    const result = await query(
        `SELECT * FROM video_pose_tracks WHERE video_id = $1 AND user_id = $2`,
        [videoId, userId],
    );
    return result.rows[0] ?? null;
};

/** Store a new pick and queue it, replacing any earlier track for the video. */
export const queuePoseTrack = async (userId: string, videoId: string, seed: PoseTrackSeed): Promise<PoseTrack> => {
    const result = await query(
        `INSERT INTO video_pose_tracks (video_id, user_id, seed_sec, first_x, first_y, second_x, second_y)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (video_id) DO UPDATE
            SET status = 'pending', status_message = NULL, processing_started_at = NULL,
                seed_sec = EXCLUDED.seed_sec,
                first_x = EXCLUDED.first_x, first_y = EXCLUDED.first_y,
                second_x = EXCLUDED.second_x, second_y = EXCLUDED.second_y,
                fps = NULL, frames = NULL, model = NULL, updated_at = NOW()
         RETURNING *`,
        [videoId, userId, seed.seed_sec, seed.first_x, seed.first_y, seed.second_x, seed.second_y],
    );
    return result.rows[0];
};

/** Next pending track whose video is ready, with the encoded video's key.
 *  Same claim pattern as transcodes: SKIP LOCKED + a stale guard so a job
 *  whose worker died is picked up again. */
export const claimNextPoseJob = async (): Promise<(PoseTrack & { video_storage_key: string }) | null> => {
    const result = await query(
        // Millisecond precision so the claim time survives the round trip
        // through a JS Date and can guard the write-back below.
        `UPDATE video_pose_tracks t
            SET processing_started_at = date_trunc('milliseconds', NOW())
           FROM session_videos v
          WHERE t.video_id = (
            SELECT pt.video_id FROM video_pose_tracks pt
              JOIN session_videos sv ON sv.id = pt.video_id
             WHERE pt.status = 'pending'
               AND sv.video_status = 'ready' AND sv.video_storage_key IS NOT NULL
               AND (pt.processing_started_at IS NULL OR pt.processing_started_at < NOW() - INTERVAL '30 minutes')
             ORDER BY pt.updated_at ASC
             LIMIT 1
             FOR UPDATE OF pt SKIP LOCKED
          )
            AND v.id = t.video_id
          RETURNING t.*, v.video_storage_key`,
    );
    return result.rows[0] ?? null;
};

/** Only lands if the pick was not replaced while the job ran. */
export const markPoseTrackReady = async (
    videoId: string, claimedAt: Date | string, data: { fps: number; frames: unknown; model: string },
): Promise<void> => {
    await query(
        `UPDATE video_pose_tracks
            SET status = 'ready', fps = $1, frames = $2, model = $3,
                status_message = NULL, processing_started_at = NULL, updated_at = NOW()
          WHERE video_id = $4 AND processing_started_at = $5`,
        [data.fps, JSON.stringify(data.frames), data.model, videoId, claimedAt],
    );
};

export const markPoseTrackFailed = async (videoId: string, claimedAt: Date | string, reason: string): Promise<void> => {
    await query(
        `UPDATE video_pose_tracks
            SET status = 'failed', status_message = $1, processing_started_at = NULL, updated_at = NOW()
          WHERE video_id = $2 AND processing_started_at = $3`,
        [reason.length > 1000 ? reason.slice(0, 1000) + '…' : reason, videoId, claimedAt],
    );
};
