-- 040: Session videos + position segments.
--
-- Adds video capture to training sessions so users can record rolling footage
-- and tag grappling positions over time. Separate from the technique library
-- (user_tags) which holds instructional clips.
--
-- session_videos: one-to-many with training_sessions (a session can have
--   multiple clips, e.g. round 1, round 2). Same R2/transcode lifecycle as
--   user_tags video columns, but as a proper relational table.
--
-- position_segments: timestamped position labels within a video. source='manual'
--   means the user tapped the position; source='model' means a classifier
--   pre-filled it (Phase 2). confirmed=false flags model suggestions awaiting
--   user review — confirmed rows feed back into training data.

CREATE TABLE IF NOT EXISTS session_videos (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                  UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Video lifecycle (mirrors the inline columns on user_tags post-mig-028)
    video_status                VARCHAR(20)
        CHECK (video_status IS NULL OR video_status IN ('processing', 'ready', 'failed')),
    video_storage_key           TEXT,           -- encoded MP4 in R2 (set when ready)
    video_raw_storage_key       TEXT,           -- raw upload in R2 (cleared after encode)
    video_byte_size             BIGINT,         -- encoded variant size
    video_status_message        TEXT,           -- error detail when status='failed'
    video_processing_started_at TIMESTAMPTZ,    -- worker claim timestamp (stale-job guard)

    -- Client-supplied metadata recorded at upload-complete time
    video_thumbnail             TEXT,           -- JPEG data URL, extracted in browser
    video_duration_seconds      INTEGER CHECK (video_duration_seconds BETWEEN 0 AND 7200),
    video_notes                 TEXT CHECK (char_length(video_notes) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_session_videos_session
    ON session_videos (session_id);

-- Worker job-claim index — same pattern as user_tags.
CREATE INDEX IF NOT EXISTS idx_session_videos_processing
    ON session_videos (created_at)
    WHERE video_status = 'processing';

CREATE TABLE IF NOT EXISTS position_segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id        UUID NOT NULL REFERENCES session_videos(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_sec       REAL NOT NULL,
    end_sec         REAL NOT NULL CHECK (end_sec > start_sec),
    position_label  VARCHAR(50) NOT NULL,
    -- 'manual' = user tapped; 'model' = classifier pre-filled (Phase 2)
    source          VARCHAR(10) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'model')),
    -- model suggestions start unconfirmed; user corrections flip to true
    confirmed       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_position_segments_video
    ON position_segments (video_id);
