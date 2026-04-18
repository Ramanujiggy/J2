-- 009: Distribution-First Persistence
--
-- Adds pillar_distribution JSONB column to training_sessions. This stores the
-- full IDW (Inverse Distance Weighting) vector computed by PillarPrism when
-- the user taps inside the pentagon — capturing the nuance of "75% guard,
-- 25% passing" instead of just the dominant pillar.
--
-- Shape: { "guard": 0.75, "passing": 0.25 } — keys are pillar values, values
-- are weights in [0, 1] summing to ~1.0 (±0.01 for float drift).
--
-- Validation is enforced at the application layer (controller). The DB-level
-- CHECK only ensures the column is a JSONB object when present — sub-queries
-- and aggregates aren't allowed in CHECK constraints.

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS pillar_distribution JSONB DEFAULT NULL;

DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_pillar_distribution_type
    CHECK (pillar_distribution IS NULL OR jsonb_typeof(pillar_distribution) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill historical sessions:
--   * If `heading` is set, distribution = { heading: 1.0 }
--   * Else if `tags` is non-empty, distribute evenly across all tags
--   * Else leave NULL (no signal to derive from — these would be malformed
--     legacy rows; new schema requires either heading or non-empty tags)
UPDATE training_sessions
SET pillar_distribution = CASE
  WHEN heading IS NOT NULL
    THEN jsonb_build_object(heading, 1.0)
  WHEN tags IS NOT NULL AND cardinality(tags) > 0
    THEN (
      SELECT jsonb_object_agg(tag, ROUND(1.0::numeric / cardinality(tags), 4))
      FROM unnest(tags) AS tag
    )
  ELSE NULL
END
WHERE pillar_distribution IS NULL;
