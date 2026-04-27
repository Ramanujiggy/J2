-- 014: Persist which pillars carried the long-press "deep work" flag at log time.
--
-- Migration 013 added a single boolean (had_deep_work) which is enough for
-- adoption telemetry but loses fidelity on read: we can't tell *which* chip
-- the user marked. That makes the post-save Prism receipt's halo rings
-- impossible to reconstruct on a re-open of the saved session.
--
-- This column stores the per-pillar set so sessionToSelections() can rehydrate
-- the deep_work flag on each chip when the user reopens a past session.
--
-- Validated against VALID_TAGS at the controller layer; DB stores raw TEXT[]
-- to mirror the pattern used by `tags` and to stay flexible if the pillar
-- vocabulary shifts.

ALTER TABLE training_sessions
    ADD COLUMN IF NOT EXISTS deep_work_pillars TEXT[];
