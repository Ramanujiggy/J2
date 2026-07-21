-- 028: Video cloud storage — Cloudflare R2 + server-side transcoding.
--
-- Move Library v2 (mig 028 supersedes mig 010's local-first model). Videos
-- now live in R2 and are transcoded to a universally-playable H.264/AAC MP4
-- by a background worker. Existing client-side OPFS storage downgrades to
-- a local cache for offline / fast-start playback.
--
-- Lifecycle on user_tags after this migration:
--
--   no video             →  has_video = FALSE,  video_status = NULL
--   uploading            →  client PUTs raw to R2 (no DB write yet)
--   queued for encode    →  has_video = TRUE,   video_status = 'processing',
--                           video_raw_storage_key set, video_storage_key NULL
--   playable             →  video_status = 'ready', video_storage_key set,
--                           video_byte_size set,    video_raw_storage_key NULL
--                                                   (worker deletes the raw)
--   transcode failed     →  video_status = 'failed', video_status_message set
--                           (raw kept in R2 so retry can re-encode)
--
-- All columns nullable + additive. Existing legacy rows (has_video=TRUE
-- without any of the new columns) are local-only and surface through the
-- one-time migration prompt in the client.

ALTER TABLE user_tags
  ADD COLUMN IF NOT EXISTS video_status VARCHAR(20)
    CHECK (video_status IS NULL OR video_status IN ('processing', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS video_storage_key TEXT,        -- encoded MP4 in R2 (set when ready)
  ADD COLUMN IF NOT EXISTS video_raw_storage_key TEXT,    -- raw upload in R2 (cleaned post-encode)
  ADD COLUMN IF NOT EXISTS video_byte_size BIGINT,        -- size of encoded variant
  ADD COLUMN IF NOT EXISTS video_status_message TEXT,     -- error info when status='failed'
  ADD COLUMN IF NOT EXISTS video_processing_started_at TIMESTAMPTZ;  -- worker claim guard

-- Worker job-claim index. Partial index on the small subset of rows actively
-- being processed keeps the index tiny while still answering the worker's
-- "give me the next job to claim" query in O(1).
CREATE INDEX IF NOT EXISTS idx_user_tags_video_processing
  ON user_tags (created_at)
  WHERE video_status = 'processing';
