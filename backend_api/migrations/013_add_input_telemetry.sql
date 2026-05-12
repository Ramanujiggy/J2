-- 013: Input telemetry — adoption signal for the chip-input replacement.
--
-- Three nullable columns. Historical rows stay NULL (they predate the chips,
-- and that's the correct semantic — guessing values would corrupt analytics).
--
--   had_primary      — true if at least one chip in the session was double-tapped
--                      (or set primary via 'P' key). Gauges discoverability of
--                      the primary mechanic.
--   had_deep_work    — true if at least one chip was long-pressed to flag deep
--                      work (or set via 'D' key). Gauges discoverability of the
--                      long-press mechanic.
--   selection_count  — number of chips selected. Surfaces whether users are
--                      actually using multi-pillar input.
--
-- Frontend computes these directly from the chip selections at submit time.
-- Server validates types but does NOT derive them from pillar_distribution
-- (which lacks the primary/deep_work distinction).

ALTER TABLE training_sessions
    ADD COLUMN IF NOT EXISTS had_primary     BOOLEAN,
    ADD COLUMN IF NOT EXISTS had_deep_work   BOOLEAN,
    ADD COLUMN IF NOT EXISTS selection_count INTEGER;

DO $$ BEGIN
    ALTER TABLE training_sessions
        ADD CONSTRAINT check_selection_count_nonneg
        CHECK (selection_count IS NULL OR selection_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
