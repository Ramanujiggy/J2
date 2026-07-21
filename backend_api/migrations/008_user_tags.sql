-- 008: Two-tier tag system
--
-- Adds user-defined tags (the "children") that map to fixed pillars (the "parents").
-- The 5 pillars (standup, passing, pins, submissions, guard) drive the math.
-- User tags drive personal vocabulary (e.g. "berimbolo" → guard, "kimura" → submissions).
--
-- Each user has their own private tag library. Sessions reference tag IDs via an
-- array column, mirroring the existing tags TEXT[] pattern for consistency.

CREATE TABLE IF NOT EXISTS user_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_pillar   VARCHAR(20) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_tags_name_length CHECK (length(name) BETWEEN 1 AND 50),
  CONSTRAINT user_tags_pillar_valid CHECK (parent_pillar IN ('standup', 'passing', 'pins', 'submissions', 'guard')),
  CONSTRAINT user_tags_unique_per_user UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON user_tags(user_id);

-- Reference column on training_sessions — array of user_tag IDs for this session.
-- The existing `tags` TEXT[] column (pillar values) is kept for backward compat;
-- new sessions can use either or both.
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS user_tag_ids UUID[] DEFAULT NULL;
