-- 024: Fix CLA session_type CHECK constraint
--
-- Migration 015 widened `check_session_type` to allow 'cla', but on prod a
-- second auto-named CHECK constraint (`sessions_session_type_check`) survived
-- — likely created during the initial Supabase table setup. Result: inserting
-- a CLA session throws 23514 against the un-widened auto-named constraint:
--
--   new row for relation "training_sessions" violates check constraint
--   "sessions_session_type_check"
--
-- Fix: drop both possible constraint names if they exist, then re-add one
-- canonical CHECK that allows the four current session_type values. Idempotent
-- so it's safe to re-run.

ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS sessions_session_type_check;
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS check_session_type;
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_session_type_check;

ALTER TABLE training_sessions
    ADD CONSTRAINT check_session_type
    CHECK (session_type IN ('class', 'drilling', 'competition_training', 'cla'));
