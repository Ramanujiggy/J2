-- 041: Pose tracks for session videos.
--
-- The user taps themselves and their partner on one frame of a roll; a
-- background job follows those two people through the clip and stores one
-- skeleton per person per sampled frame. The review player draws them as an
-- overlay, and they are the training data a position model needs later
-- (roadmap.md → Position model training).
--
-- One row per video. Re-picking the pair overwrites the row and re-queues it.
--
-- frames: JSON array, one entry per sampled frame (fps per row):
--   [first, second] where each is null or 51 integers —
--   17 COCO keypoints × [x per-mille, y per-mille, confidence percent].
-- first = the person tapped first (the user), second = their partner.

CREATE TABLE IF NOT EXISTS video_pose_tracks (
    video_id                UUID PRIMARY KEY REFERENCES session_videos(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'ready', 'failed')),
    status_message          TEXT,
    processing_started_at   TIMESTAMPTZ,           -- worker claim (stale-job guard)

    -- The tap: time in the clip, and two points normalised to the frame (0..1)
    seed_sec                REAL NOT NULL CHECK (seed_sec >= 0),
    first_x                 REAL NOT NULL CHECK (first_x BETWEEN 0 AND 1),
    first_y                 REAL NOT NULL CHECK (first_y BETWEEN 0 AND 1),
    second_x                REAL NOT NULL CHECK (second_x BETWEEN 0 AND 1),
    second_y                REAL NOT NULL CHECK (second_y BETWEEN 0 AND 1),

    fps                     REAL,
    frames                  JSONB,
    model                   VARCHAR(50),           -- which detector produced frames

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_pose_tracks_pending
    ON video_pose_tracks (updated_at)
    WHERE status = 'pending';
