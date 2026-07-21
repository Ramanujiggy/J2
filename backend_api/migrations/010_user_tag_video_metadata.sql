-- 010: Move Library (Tier 1) — video metadata on user_tags
--
-- Each user_tag can optionally have a video clip associated with it. The
-- actual video file is stored client-side (OPFS or IndexedDB) — the server
-- only persists small metadata so libraries are visible across devices even
-- when the video itself is local-only.
--
-- video_thumbnail: data URL (~10KB JPEG) extracted from the first frame.
--                  Survives device wipes; serves as a "you used to have this"
--                  placeholder when the local blob is gone.
-- has_video:       Convenience flag — true when the user has a local clip.
--                  Set client-side after successful local save; cleared on
--                  delete. Server can't verify (the file is local), so this
--                  is advisory.
-- video_duration_seconds: integer seconds, for badge display.
-- video_notes:     freeform description of the move (separate from the
--                  general session notes — this is per-technique).

ALTER TABLE user_tags ADD COLUMN IF NOT EXISTS has_video BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_tags ADD COLUMN IF NOT EXISTS video_thumbnail TEXT DEFAULT NULL;
ALTER TABLE user_tags ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER DEFAULT NULL;
ALTER TABLE user_tags ADD COLUMN IF NOT EXISTS video_notes TEXT DEFAULT NULL;

DO $$ BEGIN
  ALTER TABLE user_tags
    ADD CONSTRAINT check_user_tag_video_duration
    CHECK (video_duration_seconds IS NULL OR (video_duration_seconds >= 0 AND video_duration_seconds <= 600));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE user_tags
    ADD CONSTRAINT check_user_tag_video_notes_length
    CHECK (video_notes IS NULL OR length(video_notes) <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for the Library page's "tags with videos" filter
CREATE INDEX IF NOT EXISTS idx_user_tags_has_video ON user_tags(user_id) WHERE has_video = TRUE;
