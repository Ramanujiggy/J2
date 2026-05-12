-- 020: Class schedules
--
-- User-defined recurring class times. Each row = one weekly class slot.
-- Times are stored in the user's local clock (no tz offset baked in); the
-- scheduler converts UTC → user's IANA timezone (users.timezone, mig 019)
-- on each tick to decide whether to fire a notification.
--
-- `is_active` is a soft-delete flag so we preserve schedule history without
-- hard-deleting referenced rows. Partial index keeps queries cheap.

CREATE TABLE IF NOT EXISTS class_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun … 6=Sat
  start_time      TIME NOT NULL,
  duration_min    SMALLINT NOT NULL DEFAULT 90 CHECK (duration_min BETWEEN 15 AND 480),
  gi_nogi         VARCHAR(8) CHECK (gi_nogi IS NULL OR gi_nogi IN ('gi', 'no_gi')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS class_schedules_user_active_idx
  ON class_schedules(user_id, is_active) WHERE is_active;
