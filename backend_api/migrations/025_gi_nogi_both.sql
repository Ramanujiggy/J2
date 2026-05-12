-- 025: Widen gi_nogi CHECK constraints to allow 'both'
--
-- A user can train a session that is genuinely mixed gi + no-gi (e.g. wore
-- the gi for warmup and drilling, took it off for live rolls). Adding
-- 'both' as a third value preserves single-select on a primary axis;
-- analytics rollups treat 'both' as 0.5 gi + 0.5 no-gi.
--
-- Defensive — like migration 024 (the cla session_type fix), there may be
-- a rogue auto-named CHECK constraint surviving from initial Supabase
-- table creation. Drop every plausible name then add one canonical CHECK.
-- Idempotent so re-running is safe.

-- training_sessions.gi_nogi (mig 006 named it `check_gi_nogi`; defensive
-- drops cover the auto-generated alternates).
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS check_gi_nogi;
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS sessions_gi_nogi_check;
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_gi_nogi_check;

ALTER TABLE training_sessions
    ADD CONSTRAINT check_gi_nogi
    CHECK (gi_nogi IN ('gi', 'no_gi', 'both'));

-- class_schedules.gi_nogi (mig 020 added an inline CHECK; drop and re-add
-- with the wider set so a recurring class can be marked 'both' too).
ALTER TABLE class_schedules DROP CONSTRAINT IF EXISTS class_schedules_gi_nogi_check;

ALTER TABLE class_schedules
    ADD CONSTRAINT class_schedules_gi_nogi_check
    CHECK (gi_nogi IS NULL OR gi_nogi IN ('gi', 'no_gi', 'both'));
