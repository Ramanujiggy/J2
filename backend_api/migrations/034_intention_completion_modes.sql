-- 034_intention_completion_modes.sql
--
-- Intentions currently end based purely on calendar days (duration_days).
-- A missed scheduled session silently eats your runway, which is the
-- wrong semantic for a training-focused intention.
--
-- This migration introduces polymorphic completion modes:
--   • 'days'           — original behavior; ends after duration_days
--   • 'sessions'       — ends after target_count sessions have been
--                        logged within the intention window
--   • 'training_weeks' — ends after target_count distinct ISO weeks
--                        containing >= 1 session have passed
--
-- Existing rows default to 'days' and keep duration_days authoritative,
-- so this is purely additive — no app-level breakage. New rows can opt
-- into 'sessions' or 'training_weeks' via target_count.

ALTER TABLE weekly_intentions
    ADD COLUMN IF NOT EXISTS completion_type TEXT
        NOT NULL DEFAULT 'days'
        CHECK (completion_type IN ('days', 'sessions', 'training_weeks'));

ALTER TABLE weekly_intentions
    ADD COLUMN IF NOT EXISTS target_count INTEGER NULL
        CHECK (target_count IS NULL OR target_count > 0);

-- A non-'days' completion type without target_count is invalid — guard at
-- the row level so a buggy INSERT can't slip through.
ALTER TABLE weekly_intentions
    DROP CONSTRAINT IF EXISTS weekly_intentions_target_count_required;
ALTER TABLE weekly_intentions
    ADD CONSTRAINT weekly_intentions_target_count_required
        CHECK (
            completion_type = 'days'
            OR target_count IS NOT NULL
        );
